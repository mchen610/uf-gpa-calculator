<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { DegreeSnapshot, PendingCourse } from '$lib/types'
  import { GRADE_POINTS, normalizeGradeInput } from '$lib/grades'
  import { sum, cn, round } from '$lib/utils'
  import { typedKeys } from '$lib/typeUtils'

  const POLLING_INTERVAL = 100
  const ALL_GRADES = ['', ...typedKeys(GRADE_POINTS)]
  const WHOLE_GRADES = ALL_GRADES.filter((g) => g.length <= 1)

  let current: DegreeSnapshot = {
    gradePoints: undefined,
    hoursCarried: undefined,
    currentGpa: undefined,
    pendingClasses: [],
  }
  let pendingClasses: PendingCourse[] = []

  let rawUserInputs: Record<string, string | undefined> = {}

  let skipPlusOrMinusGrades = false
  let doAllAtOnce = false
  let showOptions = false

  let anyInputFocused = false

  let closeTimeout: ReturnType<typeof setTimeout>
  let pollingInterval: ReturnType<typeof setInterval>
  let hasLoaded = false

  function handleOpen() {
    clearTimeout(closeTimeout)
    showOptions = true
  }

  function handleClose() {
    closeTimeout = setTimeout(() => {
      showOptions = false
    }, 150)
  }

  function handleListFocusIn() {
    anyInputFocused = true
  }

  function handleListFocusOut(event: FocusEvent) {
    const list = event.currentTarget as HTMLElement
    const related = event.relatedTarget as Node | null
    if (!related || !list.contains(related)) {
      anyInputFocused = false
    }
  }

  interface ProjectionDetails {
    addedGradePoints: number
    recognizedHours: number
    enteredCount: number
  }

  let projection: ProjectionDetails = {
    addedGradePoints: 0,
    recognizedHours: 0,
    enteredCount: 0,
  }

  let gpaDiff: number = 0
  let currentUrl = ''

  function computeProjection(): ProjectionDetails {
    const inputs = pendingClasses.map((course) => {
      const { grade } = course
      const points = grade ? GRADE_POINTS[grade] : undefined
      return { course, grade, points }
    })

    return {
      addedGradePoints: sum(inputs, (i) =>
        i.points === undefined ? 0 : i.points * i.course.credits,
      ),
      recognizedHours: sum(inputs, (i) =>
        i.points === undefined ? 0 : i.course.credits,
      ),
      enteredCount: inputs.length,
    }
  }

  function getInputElementId(index: number): string {
    return `grade-input-${index}`
  }

  function focusInput(index: number) {
    document.getElementById(getInputElementId(index))?.focus()
  }

  function focusFirstInput() {
    focusInput(0)
  }

  function handleVerticalNavigation(event: KeyboardEvent, index: number) {
    event.preventDefault()
    const isDown = event.key === 'ArrowDown'
    let nextIndex = isDown ? index + 1 : index - 1

    if (nextIndex < 0) {
      nextIndex = pendingClasses.length - 1
    } else if (nextIndex >= pendingClasses.length) {
      nextIndex = 0
    }

    focusInput(nextIndex)
  }

  function handleHorizontalNavigation(event: KeyboardEvent, courseId: string) {
    event.preventDefault()
    const grades = skipPlusOrMinusGrades ? WHOLE_GRADES : ALL_GRADES
    const idx = grades.indexOf(rawUserInputs[courseId] ?? '')

    let nextGrade: string | undefined
    if (event.key === 'ArrowLeft' && idx === 0) {
      nextGrade = grades[grades.length - 1]
    } else if (event.key === 'ArrowLeft' && idx > 0) {
      nextGrade = grades[idx - 1]
    } else if (event.key === 'ArrowRight' && idx === grades.length - 1) {
      nextGrade = grades[0]
    } else if (event.key === 'ArrowRight' && idx < grades.length - 1) {
      nextGrade = grades[idx + 1]
    } else {
      return
    }
    setGradeInput(courseId, nextGrade)
  }

  function handleInputKeydown(
    event: KeyboardEvent,
    index: number,
    courseId: string,
  ) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      handleVerticalNavigation(event, index)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      handleHorizontalNavigation(event, courseId)
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented) return

    if (event.key === 'Escape') {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        event.target.blur()
        event.preventDefault()
        return
      }

      if (showOptions) {
        showOptions = false
        return
      }
    }

    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusInput(0)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusInput(pendingClasses.length - 1)
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      focusInput(0)
      handleHorizontalNavigation(event, pendingClasses[0].id)
      return
    }

    if (event.key.length === 1) {
      focusFirstInput()
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      showOptions &&
      !(event.target as Element).closest('.options-container')
    ) {
      showOptions = false
    }
  }

  function recalculate(): void {
    projection = computeProjection()

    if (
      current.gradePoints == undefined ||
      current.hoursCarried == undefined ||
      current.currentGpa == undefined
    ) {
      gpaDiff = 0
      return
    }

    const totalGradePoints = current.gradePoints + projection.addedGradePoints
    const totalHours = current.hoursCarried + projection.recognizedHours
    const projectedGpa = totalHours > 0 ? totalGradePoints / totalHours : 0
    gpaDiff = projectedGpa - current.currentGpa
  }

  function handleBatchFillChange() {
    if (doAllAtOnce) {
      focusFirstInput()
    }
  }

  function setGradeInput(courseId: string, value: string): void {
    const sanitized = value.trim().toUpperCase()
    const normalized = normalizeGradeInput(sanitized)

    if (doAllAtOnce) {
      const newInputs = { ...rawUserInputs }
      for (const course of pendingClasses) {
        newInputs[course.id] = sanitized
      }
      rawUserInputs = newInputs
      pendingClasses = pendingClasses.map((c) => ({ ...c, grade: normalized }))
    } else {
      rawUserInputs = {
        ...rawUserInputs,
        [courseId]: sanitized,
      }
      pendingClasses = pendingClasses.map((c) =>
        c.id === courseId ? { ...c, grade: normalized } : c,
      )
    }

    recalculate()
  }

  function clearAllInputs(): void {
    rawUserInputs = {}
    pendingClasses = pendingClasses.map((c) => ({ ...c, grade: undefined }))
    recalculate()
  }

  async function fetchSnapshot(): Promise<void> {
    if (hasLoaded) return

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (tab.id === undefined || tab.url === undefined) {
      return
    }

    currentUrl = tab.url
    try {
      const data = await chrome.tabs.sendMessage(tab.id, {
        type: 'getSnapshot',
      })
      if (data) {
        applySnapshot(data)
        hasLoaded = true
        clearInterval(pollingInterval)
      }
    } catch {}
  }

  async function applySnapshot(data: DegreeSnapshot): Promise<void> {
    rawUserInputs = {}
    current = data
    pendingClasses = data.pendingClasses
    recalculate()

    await tick()
    focusFirstInput()
  }

  onMount(() => {
    fetchSnapshot()
    pollingInterval = setInterval(fetchSnapshot, POLLING_INTERVAL)
    return () => clearInterval(pollingInterval)
  })
</script>

<svelte:window on:keydown={handleKeydown} on:click={handleClickOutside} />

<main
  class={cn(
    'min-w-96',
    'font-sans bg-white text-slate-800',
    'selection:bg-indigo-50 selection:text-indigo-900',
  )}
>
  <div class="mx-auto flex w-full max-w-md flex-col p-6 pb-3 space-y-3">
    <!-- Header -->
    <header class="space-y-1">
      <h1 class="text-sm font-medium text-slate-700">one.uf gpa calculator</h1>

      {#if current.gradePoints !== undefined && current.hoursCarried !== undefined && current.currentGpa !== undefined}
        <p class="text-xs text-slate-400">
          use arrow keys to navigate between grades and courses
        </p>
      {/if}
    </header>

    <!-- Stats Row -->
    {#if current.gradePoints === undefined || current.hoursCarried === undefined || current.currentGpa === undefined}
      <div class="flex flex-col items-center justify-center py-12 text-center">
        {#if currentUrl.includes('one.uf.edu/transcript')}
          <div class="flex flex-col items-center gap-3">
            <div
              class="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"
            ></div>
            <p class="text-xs text-slate-500">
              Waiting for transcript to load...
            </p>
          </div>
        {:else}
          <div class="flex items-center gap-1">
            <p class="text-xs text-slate-500">navigate to</p>
            <a
              href="https://one.uf.edu/transcript"
              target="_blank"
              class="text-xs font-medium text-slate-500 underline decoration-slate-400 hover:text-slate-700"
              >one.uf.edu/transcript</a
            >
            <p class="text-xs text-slate-500">to use.</p>
          </div>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="text-xs text-slate-400 mb-0.5">current gpa</div>
          <div class="text-sm text-slate-900 flex items-baseline">
            {round(current.currentGpa)}
            <span
              class="text-xxs text-slate-400 font-normal ml-1 tracking-wider inline-flex gap-0.5"
            >
              <span>{round(current.gradePoints)}</span>
              <span>/</span>
              <span>{round(current.hoursCarried, 0)}</span>
            </span>
          </div>
        </div>
        <div>
          <div class="text-xs text-slate-400 mb-0.5">projected gpa</div>
          <div class="text-sm text-indigo-500 flex items-baseline">
            {round(
              (current.gradePoints + projection.addedGradePoints) /
                (current.hoursCarried + projection.recognizedHours),
            )}
            <span
              class="text-xxs text-indigo-300 font-normal ml-1 tracking-wider inline-flex gap-0.5"
            >
              <span>
                {round(current.gradePoints + projection.addedGradePoints, 2)}
              </span>
              <span>/</span>
              <span>
                {round(current.hoursCarried + projection.recognizedHours, 0)}
              </span>
            </span>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="w-full h-px relative overflow-hidden">
        <div
          class="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-200 via-slate-200 to-white to-100% via-80%"
        ></div>
      </div>

      <!-- Pending Classes Section -->
      <section>
        <div class="flex items-start justify-between mb-2">
          <div class="flex flex-col gap-0.5">
            <div class="text-xs text-slate-400">gpa diff</div>
            <div
              class={cn(
                'flex items-center gap-1 text-xs',
                gpaDiff > 0 && 'text-blue-600',
                gpaDiff < 0 && 'text-rose-600',
                gpaDiff === 0 && 'text-slate-500',
              )}
            >
              <span>{Math.abs(gpaDiff).toFixed(3)}</span>
              <span>{gpaDiff > 0 ? '↑' : gpaDiff < 0 ? '↓' : ''}</span>
            </div>
          </div>

          <div class="flex flex-col items-end gap-0.5">
            <button
              on:click={clearAllInputs}
              tabindex="-1"
              class="text-xs text-slate-400 hover:text-slate-600 transition-colors tracking-wide"
            >
              clear all
            </button>
            <div
              class="relative options-container"
              role="group"
              on:mouseenter={handleOpen}
              on:mouseleave={handleClose}
              on:focusin={handleOpen}
              on:focusout={handleClose}
            >
              <button
                tabindex="-1"
                class="text-xs text-slate-600 hover:text-black transition-colors tracking-wide flex gap-1"
              >
                options
              </button>

              {#if showOptions}
                <div
                  class={cn(
                    'absolute right-0 top-full z-10 mt-1',
                    'flex flex-col gap-2 min-w-32 p-2',
                    'bg-white shadow-lg border border-slate-100 rounded-md',
                  )}
                >
                  <label
                    class="flex items-center gap-2 text-xxs text-slate-400 hover:text-slate-600 transition-colors tracking-wide cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      bind:checked={skipPlusOrMinusGrades}
                      class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3 cursor-pointer"
                    />
                    skip +/- grades
                  </label>
                  <label
                    class="flex items-center gap-2 text-xxs text-slate-400 hover:text-slate-600 transition-colors tracking-wide cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      bind:checked={doAllAtOnce}
                      on:change={handleBatchFillChange}
                      class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3 cursor-pointer"
                    />
                    do all at once
                  </label>
                </div>
              {/if}
            </div>
          </div>
        </div>

        {#if pendingClasses.length === 0}
          <div class="py-6 text-center text-xs text-slate-400">
            Sync with your UF grade summary to see classes.
          </div>
        {:else}
          <ul
            class="flex flex-col gap-1"
            on:focusin={handleListFocusIn}
            on:focusout={handleListFocusOut}
          >
            {#each pendingClasses as course, index}
              <li class="flex items-center gap-3 py-2 group">
                <input
                  id={getInputElementId(index)}
                  class={cn(
                    'w-6 border-b pb-0.5',
                    'text-center text-sm',
                    'bg-transparent text-slate-600 placeholder:text-slate-300',
                    'outline-none transition-colors focus:placeholder:text-transparent focus:border-indigo-600',
                    doAllAtOnce && anyInputFocused
                      ? 'border-indigo-600'
                      : 'border-slate-300',
                  )}
                  type="text"
                  value={rawUserInputs[course.id] ?? ''}
                  on:input={(event) =>
                    setGradeInput(course.id, event.currentTarget.value)}
                  on:keydown={(event) =>
                    handleInputKeydown(event, index, course.id)}
                  maxlength="2"
                  placeholder={'X'}
                />
                <div class="flex flex-col">
                  <span class="text-xs text-slate-700">{course.title}</span>
                  <span class="text-xs text-slate-400"
                    >{course.credits} credits</span
                  >
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </div>
</main>
