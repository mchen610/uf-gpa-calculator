<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { DegreeSnapshot, PendingCourse, ProjectionDetails } from '$shared/types'
  import { GRADE_POINTS, normalizeGradeInput, computeProjection, isValidGrade, type Grade } from './lib/grades'
  import { getDegreeSnapshot, refreshDegreeSnapshot } from './lib/api'
  import { loadLocalState, saveLocalState } from './lib/storage'
  import { round } from '$shared/utils'
  import { cn } from './lib/utils'
  import { typedKeys } from '$shared/typeUtils'
  import { X, Settings2, RotateCcw } from 'lucide-svelte'

  const VALID_GRADES = ['', ...typedKeys(GRADE_POINTS)]

  let current: Omit<DegreeSnapshot, 'pendingCourses'> | undefined = undefined
  let pendingCourses: PendingCourse[] = []

  let rawUserInputs: Record<string, string | undefined> = {}

  let fillAllAtOnce = false
  let advancedMode = false
  let showOptions = false
  let anyGradeInputFocused = false

  let isLoadingTranscript = true
  let isOnUfWebsite = false

  let projection: ProjectionDetails = {
    addedGradePoints: 0,
    addedCreditHours: 0,
  }

  $: projection = computeProjection(pendingCourses)

  function getInputElementId(index: number): string {
    return `grade-input-${index}`
  }

  type InputState = 'empty' | 'valid' | 'invalid'

  function getInputState(courseId: number): InputState {
    const raw = rawUserInputs[courseId]
    if (!raw) return 'empty'
    return isValidGrade(raw) ? 'valid' : 'invalid'
  }

  function focusInput(index: number) {
    document.getElementById(getInputElementId(index))?.focus()
  }

  function focusFirstInput() {
    focusInput(0)
  }

  function handleVerticalNavigation(event: KeyboardEvent, index: number) {
    event.preventDefault()
    let nextIndex: number | undefined
    if (event.key === 'ArrowDown') {
      nextIndex = index + 1
    } else if (event.key === 'ArrowUp') {
      nextIndex = index - 1
    } else {
      throw new Error(`Unexpected keyboard event ${event.key}`)
    }

    const normalizedIndex = (nextIndex + pendingCourses.length) % pendingCourses.length

    focusInput(normalizedIndex)
  }

  function handleHorizontalNavigation(event: KeyboardEvent, courseId: number) {
    event.preventDefault()
    const currentIndex = VALID_GRADES.indexOf(rawUserInputs[courseId] ?? '')

    let nextIndex: number | undefined

    if (currentIndex === -1) {
      nextIndex = 0
    } else if (event.key === 'ArrowLeft') {
      nextIndex = currentIndex - 1
    } else if (event.key === 'ArrowRight') {
      nextIndex = currentIndex + 1
    } else {
      throw new Error(`Unexpected keyboard event ${event.key}`)
    }

    const normalizedIndex = (nextIndex + VALID_GRADES.length) % VALID_GRADES.length
    setGradeInput(courseId, VALID_GRADES[normalizedIndex])
  }

  function handleInputKeydown(event: KeyboardEvent, index: number, courseId: number) {
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
      handleHorizontalNavigation(event, pendingCourses[0].id)
      return
    }

    if (event.key.length === 1) {
      focusFirstInput()
    }
  }

  function handleBatchFillChange() {
    if (fillAllAtOnce) {
      focusFirstInput()
    }
  }

  function setGradeInput(courseId: number, value: string): void {
    const sanitized = value.trim().toUpperCase()
    const normalized = normalizeGradeInput(sanitized)

    if (fillAllAtOnce) {
      const newInputs = { ...rawUserInputs }
      for (const course of pendingCourses) {
        newInputs[course.id] = sanitized
      }
      rawUserInputs = newInputs
      pendingCourses = pendingCourses.map((c) => ({ ...c, grade: normalized }))
    } else {
      rawUserInputs = {
        ...rawUserInputs,
        [courseId]: sanitized,
      }
      pendingCourses = pendingCourses.map((c) => (c.id === courseId ? { ...c, grade: normalized } : c))
    }

    saveLocalState({ rawUserInputs, lastFocusedCourseId: sanitized ? courseId : 'unset' })
  }

  function clearAllInputs(): void {
    rawUserInputs = {}
    pendingCourses = pendingCourses.map((c) => ({ ...c, grade: undefined }))
    saveLocalState({ rawUserInputs: {}, lastFocusedCourseId: 'unset' })
  }

  async function fetchSnapshot(): Promise<void> {
    const snapshot = await getDegreeSnapshot()

    isLoadingTranscript = false

    if (snapshot) {
      await applySnapshot(snapshot)
    }
  }

  async function handleRefresh(): Promise<void> {
    current = undefined
    pendingCourses = []
    isLoadingTranscript = true

    const snapshot = await refreshDegreeSnapshot()

    isLoadingTranscript = false

    if (snapshot) {
      await applySnapshot(snapshot)
    }
  }

  async function applySnapshot(data: DegreeSnapshot): Promise<void> {
    const { gradePoints, creditHours, term, level } = data
    current = { gradePoints, creditHours, term, level }

    const { rawUserInputs: savedInputs, lastFocusedCourseId } = await loadLocalState()
    pendingCourses = data.pendingCourses.map((course) => ({
      ...course,
      grade: normalizeGradeInput(savedInputs[course.id] ?? ''),
    }))
    rawUserInputs = savedInputs

    await tick()

    const lastFocusedIndex = pendingCourses.findIndex((c) => c.id === lastFocusedCourseId)
    if (lastFocusedIndex === -1) {
      focusInput(0)
    } else {
      focusInput(lastFocusedIndex)
    }
  }

  async function checkIfOnOneUf(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    isOnUfWebsite = tab?.url?.includes('one.uf.edu') ?? false
  }

  onMount(() => {
    checkIfOnOneUf()
    fetchSnapshot()
  })
</script>

<svelte:window on:keydown={handleKeydown} />

<main class={cn('min-w-96', 'font-sans bg-white text-slate-800', 'selection:bg-indigo-50 selection:text-indigo-900')}>
  <div class="mx-auto w-full max-w-md flex-col p-6 pb-3 space-y-2">
    <header class="flex flex-col gap-1 mb-4">
      <div class="group/header flex items-center justify-between">
        <span class="text-sm font-medium text-slate-700">one.uf gpa calculator</span>
        <button
          on:click={handleRefresh}
          disabled={!isOnUfWebsite || isLoadingTranscript}
          class="text-slate-400 disabled:cursor-not-allowed opacity-0 hover:opacity-100 transition-opacity"
          title={isOnUfWebsite ? 'Refresh transcript' : 'Navigate to one.uf.edu to refresh'}
        >
          <RotateCcw size={14} />
        </button>
      </div>
      {#if current !== undefined}
        <p class="text-xs text-slate-400">type a grade (A, B+, C...) or use arrow keys to navigate.</p>
      {/if}
    </header>

    {#if isLoadingTranscript}
      <div class="h-28 flex flex-col items-center justify-center text-center">
        <div class="flex flex-col items-center gap-3">
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"></div>
          <p class="text-xs text-slate-500">loading transcript from one.uf...</p>
        </div>
      </div>
    {:else if current === undefined}
      <div class="h-28 flex flex-col items-center justify-center text-center">
        <div class="flex items-center gap-1">
          {#if isOnUfWebsite}
            <a
              href="https://one.uf.edu/shib/login"
              target="_blank"
              class="text-xs font-medium text-slate-500 underline decoration-slate-400 hover:text-slate-700"
              >log into one.uf</a
            >
          {:else}
            <p class="text-xs text-slate-500">go to</p>
            <a
              href="https://one.uf.edu"
              target="_blank"
              class="text-xs font-medium text-slate-500 underline decoration-slate-400 hover:text-slate-700"
              >one.uf.edu</a
            >
            <p class="text-xs text-slate-500">to use.</p>
          {/if}
        </div>
      </div>
    {:else}
      <div class="flex items-end justify-between">
        <div>
          <p class="text-xs text-slate-400 mb-0.5">current gpa</p>
          <p>
            <span class="text-sm text-slate-700">
              {round(current.gradePoints / current.creditHours)}
            </span>
            {#if advancedMode}
              <span class="text-xxs text-slate-400 font-normal tracking-wider inline-flex gap-0.5">
                <span>{round(current.gradePoints)} grade points</span>
                <span>/</span>
                <span>{round(current.creditHours, 0)} credit hours</span>
              </span>
            {/if}
          </p>
        </div>
      </div>

      <div class="w-full h-px relative overflow-hidden">
        <div
          class={cn(
            'absolute inset-0 h-full w-full',
            'bg-gradient-to-r from-slate-200 via-slate-200 to-white to-100% via-90%',
          )}
        ></div>
      </div>

      <section>
        <div class="flex items-end justify-between mb-2">
          <div>
            <p class="text-xs text-indigo-400 mb-0.5">projected gpa</p>
            <p>
              <span class="text-sm font-medium text-indigo-500">
                {round(
                  (current.gradePoints + projection.addedGradePoints) /
                    (current.creditHours + projection.addedCreditHours),
                )}
              </span>
              {#if advancedMode}
                <span class="text-xxs text-indigo-300 font-normal tracking-wider inline-flex gap-0.5">
                  <span>
                    {round(current.gradePoints + projection.addedGradePoints, 2)} grade points
                  </span>
                  <span>/</span>
                  <span>
                    {round(current.creditHours + projection.addedCreditHours, 0)} credit hours
                  </span>
                </span>
              {/if}
            </p>
          </div>

          <div class="flex flex-col items-end gap-1">
            <button
              on:click={clearAllInputs}
              tabindex="-1"
              class="text-xs text-slate-400 hover:text-slate-600 transition-colors tracking-wide flex items-center gap-0.5"
            >
              clear all
              <X size={12} strokeWidth={2} />
            </button>
            <div
              class="relative options-container"
              role="group"
              on:mouseenter={() => (showOptions = true)}
              on:mouseleave={() => (showOptions = false)}
            >
              <button
                tabindex="-1"
                class="text-xs text-slate-600 hover:text-black transition-colors tracking-wide flex items-center gap-0.5"
              >
                options
                <Settings2 size={12} strokeWidth={2} />
              </button>

              {#if showOptions}
                <div class="absolute right-0 top-full z-10 pt-0.5">
                  <div class={cn('flex flex-col gap-2 p-2', 'bg-white shadow-lg border border-slate-100 rounded-md')}>
                    <label
                      class="flex items-center gap-1 text-xxs text-slate-400 hover:text-slate-600 transition-colors tracking-wide cursor-pointer text-nowrap"
                    >
                      <input
                        type="checkbox"
                        bind:checked={fillAllAtOnce}
                        on:change={handleBatchFillChange}
                        class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3 cursor-pointer"
                      />
                      fill all at once
                    </label>
                    <label
                      class="flex items-center gap-1 text-xxs text-slate-400 hover:text-slate-600 transition-colors tracking-wide cursor-pointer text-nowrap"
                    >
                      <input
                        type="checkbox"
                        bind:checked={advancedMode}
                        class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3 cursor-pointer"
                      />
                      show details
                    </label>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>

        {#if pendingCourses.length === 0}
          <div class="py-6 text-center text-xs text-slate-400">Sync with your UF grade summary to see classes.</div>
        {:else}
          <ul class="flex flex-col gap-0.5 group">
            {#each pendingCourses as course, index}
              {@const inputState = getInputState(course.id)}
              <li class="flex items-center gap-3 py-1.5">
                <div class="relative">
                  <input
                    id={getInputElementId(index)}
                    class={cn(
                      'w-8 h-7 rounded-md',
                      'text-center text-sm',
                      'outline-none focus:ring-1 focus:ring-blue-500/20',
                      inputState === 'empty' && 'border border-slate-300 bg-transparent',
                      inputState === 'valid' && 'border border-blue-200 bg-blue-50 text-blue-600 font-medium',
                      inputState === 'invalid' && 'border border-slate-300 bg-transparent text-slate-400',
                      fillAllAtOnce && anyGradeInputFocused && 'border-purple-300 ring-1 ring-purple-300/20',
                    )}
                    type="text"
                    value={rawUserInputs[course.id] ?? ''}
                    on:input={(event) => setGradeInput(course.id, event.currentTarget.value)}
                    on:keydown={(event) => handleInputKeydown(event, index, course.id)}
                    on:focus={() => (anyGradeInputFocused = true)}
                    on:blur={() => (anyGradeInputFocused = false)}
                    maxlength="2"
                  />
                  {#if advancedMode}
                    <span
                      class={cn(
                        'absolute -bottom-4 left-1/2 -translate-x-1/2 text-xxs tabular-nums',
                        course.grade ? 'text-blue-400' : 'text-slate-400',
                      )}
                    >
                      {course.grade ? GRADE_POINTS[course.grade].toFixed(2) : '0.00'}
                    </span>
                  {/if}
                </div>
                <div class="flex flex-col leading-tight">
                  <p>
                    <span class="text-xs text-slate-700">{course.title}</span>
                    <span class="text-xxs text-slate-400">{course.code}</span>
                  </p>
                  <p class={cn('text-xs', inputState === 'valid' ? 'text-blue-400' : 'text-slate-400')}>
                    {course.credits} credits
                  </p>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </div>
</main>
