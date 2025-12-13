<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { DegreeSnapshot, PendingCourse, ProjectionDetails } from '$lib/types'
  import { GRADE_POINTS, normalizeGradeInput } from '$lib/grades'
  import { sum, cn, round } from '$lib/utils'
  import { typedKeys } from '$lib/typeUtils'
  import { X, Settings2 } from 'lucide-svelte'

  const POLLING_INTERVAL = 100
  const ALL_POSSIBLE_GRADES = ['', ...typedKeys(GRADE_POINTS)]
  const GRADES_WITHOUT_PLUSES_OR_MINUSES = ALL_POSSIBLE_GRADES.filter((g) => g.length <= 1)

  let current: Omit<DegreeSnapshot, 'pendingCourses'> = {
    gradePoints: undefined,
    creditHours: undefined,
  }
  let pendingCourses: PendingCourse[] = []

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

  let projection: ProjectionDetails = {
    addedGradePoints: 0,
    addedCreditHours: 0,
  }

  $: projection = computeProjection(pendingCourses)

  let currentUrl = ''

  function computeProjection(courses: PendingCourse[]): ProjectionDetails {
    const userInputs = courses.map((course) => {
      const { credits, grade } = course
      const points = grade ? GRADE_POINTS[grade] : undefined
      return points !== undefined ? { credits, points } : undefined
    })

    return {
      addedGradePoints: sum(userInputs, (input) => (input === undefined ? 0 : input.points * input.credits)),
      addedCreditHours: sum(userInputs, (input) => (input === undefined ? 0 : input.credits)),
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
      nextIndex = pendingCourses.length - 1
    } else if (nextIndex >= pendingCourses.length) {
      nextIndex = 0
    }

    focusInput(nextIndex)
  }

  function handleHorizontalNavigation(event: KeyboardEvent, courseId: string) {
    event.preventDefault()
    const grades = skipPlusOrMinusGrades ? GRADES_WITHOUT_PLUSES_OR_MINUSES : ALL_POSSIBLE_GRADES
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

  function handleInputKeydown(event: KeyboardEvent, index: number, courseId: string) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      handleVerticalNavigation(event, index)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      handleHorizontalNavigation(event, courseId)
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented) return

    if (event.key === 'Escape') {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        event.target.blur()
        event.preventDefault()
        return
      }

      if (showOptions) {
        showOptions = false
        return
      }
    }

    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
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
      focusInput(pendingCourses.length - 1)
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      focusInput(0)
      handleHorizontalNavigation(event, pendingCourses[0].code)
      return
    }

    if (event.key.length === 1) {
      focusFirstInput()
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (showOptions && !(event.target as Element).closest('.options-container')) {
      showOptions = false
    }
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
      for (const course of pendingCourses) {
        newInputs[course.code] = sanitized
      }
      rawUserInputs = newInputs
      pendingCourses = pendingCourses.map((c) => ({ ...c, grade: normalized }))
    } else {
      rawUserInputs = {
        ...rawUserInputs,
        [courseId]: sanitized,
      }
      pendingCourses = pendingCourses.map((c) => (c.code === courseId ? { ...c, grade: normalized } : c))
    }
  }

  function clearAllInputs(): void {
    rawUserInputs = {}
    pendingCourses = pendingCourses.map((c) => ({ ...c, grade: undefined }))
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
    const { gradePoints, creditHours } = data
    rawUserInputs = {}
    current = { gradePoints, creditHours }
    pendingCourses = data.pendingCourses

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

<main class={cn('min-w-96', 'font-sans bg-white text-slate-800', 'selection:bg-indigo-50 selection:text-indigo-900')}>
  <div class="mx-auto flex w-full max-w-md flex-col p-6 pb-3 space-y-3">
    <!-- Header -->
    <header class="space-y-1">
      <span class="text-sm font-medium text-slate-700">one.uf gpa calculator</span>

      {#if current.gradePoints !== undefined && current.creditHours !== undefined}
        <p class="text-xs text-slate-400">use arrow keys to navigate between grades and courses.</p>
      {/if}
    </header>

    <!-- Stats Row -->
    {#if current.gradePoints === undefined || current.creditHours === undefined}
      <div class="flex flex-col items-center justify-center py-12 text-center">
        {#if currentUrl.includes('one.uf.edu/transcript')}
          <div class="flex flex-col items-center gap-3">
            <div class="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"></div>
            <p class="text-xs text-slate-500">Waiting for transcript to load...</p>
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
      <div>
        <p class="text-xs text-slate-400 mb-0.5">current gpa</p>
        <p>
          <span class="text-sm text-slate-900">
            {round(current.gradePoints / current.creditHours)}
          </span>
          <span class="text-xxs text-slate-400 font-normal tracking-wider inline-flex gap-0.5">
            <span>{round(current.gradePoints)} grade points</span>
            <span>/</span>
            <span>{round(current.creditHours, 0)} credit hours</span>
          </span>
        </p>
      </div>

      <!-- Divider -->
      <div class="w-full h-px relative overflow-hidden">
        <div
          class="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-200 via-slate-200 to-white to-100% via-90%"
        ></div>
      </div>

      <!-- Pending Classes Section -->
      <section>
        <div class="flex items-end justify-between mb-2">
          <div>
            <p class="text-xs text-indigo-400 mb-0.5">projected gpa</p>
            <p>
              <span class="text-sm text-indigo-500">
                {round(
                  (current.gradePoints + projection.addedGradePoints) /
                    (current.creditHours + projection.addedCreditHours),
                )}
              </span>
              <span class="text-xxs text-indigo-300 font-normal tracking-wider inline-flex gap-0.5">
                <span>
                  {round(current.gradePoints + projection.addedGradePoints, 2)} grade points
                </span>
                <span>/</span>
                <span>
                  {round(current.creditHours + projection.addedCreditHours, 0)} credit hours
                </span>
              </span>
            </p>
          </div>

          <div class="flex flex-col items-end gap-0.5">
            <button
              on:click={clearAllInputs}
              tabindex="-1"
              class="text-xs text-slate-400 hover:text-slate-600 transition-colors tracking-wide flex items-center gap-1"
            >
              clear all
              <X size={12} strokeWidth={2} />
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
                class="text-xs text-slate-600 hover:text-black transition-colors tracking-wide flex items-center gap-1"
              >
                options
                <Settings2 size={12} strokeWidth={2} />
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

        {#if pendingCourses.length === 0}
          <div class="py-6 text-center text-xs text-slate-400">Sync with your UF grade summary to see classes.</div>
        {:else}
          <ul class="flex flex-col gap-1" on:focusin={handleListFocusIn} on:focusout={handleListFocusOut}>
            {#each pendingCourses as course, index}
              <li class="flex items-center gap-3 py-2">
                <input
                  id={getInputElementId(index)}
                  class={cn(
                    'w-6 border-b pb-0.5',
                    'text-center text-sm',
                    'bg-transparent text-slate-600 placeholder:text-slate-300',
                    'outline-none transition-colors focus:placeholder:text-transparent focus:border-indigo-600',
                    doAllAtOnce && anyInputFocused ? 'border-indigo-600' : 'border-slate-300',
                  )}
                  type="text"
                  value={rawUserInputs[course.code] ?? ''}
                  on:input={(event) => setGradeInput(course.code, event.currentTarget.value)}
                  on:keydown={(event) => handleInputKeydown(event, index, course.code)}
                  maxlength="2"
                  placeholder={'?'}
                />
                <div class="flex flex-col">
                  <p>
                    <span class="text-xs text-slate-700">{course.title}</span>
                    <span class="text-xxs text-slate-400">{course.code}</span>
                  </p>
                  <p class="text-xs text-indigo-400">{course.credits} credits</p>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </div>
</main>
