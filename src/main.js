const STORAGE_KEY = 'notes_v2'
const LEGACY_STORAGE_KEY = 'notes'

const addNewNoteBtn = document.querySelector('.addNewNote')
const exportNotesBtn = document.querySelector('.exportNotes')
const importNotesBtn = document.querySelector('.importNotes')
const importFileInput = document.querySelector('#importFileInput')
const searchNotesInput = document.querySelector('#searchNotes')
const sortNotesSelect = document.querySelector('#sortNotes')
const formatModeSelect = document.querySelector('#formatMode')
const masterEl = document.querySelector('.master')
const emptyStateEl = document.querySelector('.txt-newNote')
const undoToastEl = document.querySelector('.undoToast')
const undoDeleteBtn = document.querySelector('.undoDeleteBtn')

let notes = getStoredNotes()
let searchQuery = ''
let sortMode = 'updated_desc'
let formatMode = getStoredFormatMode()
let pendingDelete = null

function getStoredFormatMode() {
  const storedMode = localStorage.getItem('notes_format_mode')
  return storedMode === 'markdown' ? 'markdown' : 'whatsapp'
}

function generateId() {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeNote(rawNote) {
  if (typeof rawNote === 'string') {
    const timestamp = Date.now()
    return {
      id: generateId(),
      title: '',
      content: rawNote,
      tags: [],
      pinned: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  }

  if (!rawNote || typeof rawNote !== 'object') {
    return null
  }

  const timestamp = Date.now()
  const rawTags = Array.isArray(rawNote.tags)
    ? rawNote.tags
    : typeof rawNote.tags === 'string'
      ? rawNote.tags.split(',')
      : []

  return {
    id: typeof rawNote.id === 'string' && rawNote.id.trim() ? rawNote.id : generateId(),
    title: typeof rawNote.title === 'string' ? rawNote.title : '',
    content: typeof rawNote.content === 'string' ? rawNote.content : '',
    tags: rawTags
      .map(tag => String(tag).trim())
      .filter(Boolean)
      .slice(0, 10),
    pinned: Boolean(rawNote.pinned),
    createdAt:
      typeof rawNote.createdAt === 'number' ? rawNote.createdAt : timestamp,
    updatedAt:
      typeof rawNote.updatedAt === 'number'
        ? rawNote.updatedAt
        : typeof rawNote.createdAt === 'number'
          ? rawNote.createdAt
          : timestamp,
  }
}

function getStoredNotes() {
  try {
    const storedV2 = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (Array.isArray(storedV2)) {
      return storedV2.map(normalizeNote).filter(Boolean)
    }

    const legacyStoredNotes = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY))
    if (Array.isArray(legacyStoredNotes)) {
      return legacyStoredNotes.map(normalizeNote).filter(Boolean)
    }

    return []
  } catch {
    return []
  }
}

function persistNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}

function sanitizeMarkdownHtml(html) {
  const template = document.createElement('template')
  template.innerHTML = html

  template.content.querySelectorAll('script, iframe, object, embed').forEach(el => {
    el.remove()
  })

  template.content.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attribute => {
      const attributeName = attribute.name.toLowerCase()
      const attributeValue = attribute.value.trim().toLowerCase()

      if (attributeName.startsWith('on')) {
        el.removeAttribute(attribute.name)
      }

      if (
        ['href', 'src', 'xlink:href'].includes(attributeName) &&
        attributeValue.startsWith('javascript:')
      ) {
        el.removeAttribute(attribute.name)
      }
    })
  })

  return template.innerHTML
}

function renderMarkdown(text) {
  const parsed =
    typeof marked.parse === 'function' ? marked.parse(text || '') : marked(text || '')
  return sanitizeMarkdownHtml(parsed)
}

function parseWhatsApp(text) {
  if (!text) {
    return ''
  }

  const placeholders = []
  let processed = escapeAttr(text)

  const pushPlaceholder = html => {
    const id = `__PH_${Date.now()}_${placeholders.length}_${Math.random()
      .toString(36)
      .slice(2, 8)}__`
    placeholders.push({ id, html })
    return id
  }

  processed = processed.replace(/```([\s\S]*?)```/g, (_, content) => {
    return pushPlaceholder(`<pre><code>${content}</code></pre>`)
  })

  processed = processed.replace(/`([^`\n]+)`/g, (_, content) => {
    return pushPlaceholder(`<code>${content}</code>`)
  })

  const applyDelimitedStyle = (input, delimiter, tagName) => {
    const escapedDelimiter = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(
      `(^|[\\s([{])${escapedDelimiter}([^${escapedDelimiter}\\n](?:[\\s\\S]*?[^${escapedDelimiter}\\n])?)${escapedDelimiter}(?=$|[\\s)\\]}.!?;:,])`,
      'gm'
    )

    return input.replace(regex, `$1<${tagName}>$2</${tagName}>`)
  }

  processed = applyDelimitedStyle(processed, '*', 'strong')
  processed = applyDelimitedStyle(processed, '_', 'em')
  processed = applyDelimitedStyle(processed, '~', 's')
  processed = processed.replace(/\n/g, '<br>')

  placeholders.forEach(item => {
    processed = processed.replace(item.id, item.html)
  })

  return processed
}

function renderText(text) {
  if (formatMode === 'whatsapp') {
    return sanitizeMarkdownHtml(parseWhatsApp(text))
  }

  return renderMarkdown(text)
}

function getEditorPlaceholder() {
  if (formatMode === 'whatsapp') {
    return 'Digite: *negrito* _itálico_ ~tachado~ `código`'
  }

  return 'Digite aqui suas anotações com markdown'
}

function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function sortedNotes(sourceNotes) {
  const sorted = [...sourceNotes]

  sorted.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1
    }

    switch (sortMode) {
      case 'updated_asc':
        return a.updatedAt - b.updatedAt
      case 'created_desc':
        return b.createdAt - a.createdAt
      case 'title_asc':
        return a.title.localeCompare(b.title, 'pt-BR')
      case 'updated_desc':
      default:
        return b.updatedAt - a.updatedAt
    }
  })

  return sorted
}

function filteredNotes() {
  const query = searchQuery.trim().toLowerCase()
  if (!query) {
    return sortedNotes(notes)
  }

  return sortedNotes(
    notes.filter(note => {
      const target = [note.title, note.content, note.tags.join(' ')].join(' ')
      return target.toLowerCase().includes(query)
    })
  )
}

function updateEmptyState() {
  const hasVisibleNotes = filteredNotes().length > 0
  emptyStateEl.classList.toggle('hidden', hasVisibleNotes)

  if (!hasVisibleNotes && searchQuery.trim()) {
    emptyStateEl.textContent = 'Nenhuma nota encontrada para essa busca.'
    return
  }

  emptyStateEl.innerHTML = 'Clique no botão "<ion-icon name="add"></ion-icon>"'
}

function setEditMode(noteEl, isEditing, note, options = {}) {
  const { rerenderOnSave = true, focusOnEdit = true } = options
  const main = noteEl.querySelector('.main')
  const textArea = noteEl.querySelector('textarea')
  const titleInput = noteEl.querySelector('.note-title')
  const tagsInput = noteEl.querySelector('.note-tags')
  const editBtnLabel = noteEl.querySelector('.edit-label')

  main.classList.toggle('hidden', isEditing)
  textArea.classList.toggle('hidden', !isEditing)
  titleInput.readOnly = !isEditing
  tagsInput.readOnly = !isEditing
  noteEl.classList.toggle('editing', isEditing)
  editBtnLabel.textContent = isEditing ? 'Salvar' : 'Editar'

  if (!isEditing) {
    note.updatedAt = Date.now()
    persistNotes()
    updateTimestamp(noteEl, note)
    if (rerenderOnSave) {
      renderNotes()
    }
  } else if (focusOnEdit) {
    textArea.focus()
  }
}

function updateTimestamp(noteEl, note) {
  const created = noteEl.querySelector('.created-at')
  const updated = noteEl.querySelector('.updated-at')

  created.textContent = `Criada: ${formatDate(note.createdAt)}`
  updated.textContent = `Atualizada: ${formatDate(note.updatedAt)}`
}

function createNoteElement(note) {
  const noteEl = document.createElement('section')
  noteEl.classList.add('note', 'fade-in')
  noteEl.dataset.noteId = note.id

  noteEl.innerHTML = `
    <div class="tools">
      <button class="pin" aria-label="Fixar nota">
        <ion-icon name="${note.pinned ? 'bookmark' : 'bookmark-outline'}"></ion-icon>
      </button>
      <button class="edit" aria-label="Editar ou salvar nota">
        <span class="edit-label">Editar</span>
        <ion-icon name="create"></ion-icon>
      </button>
      <button class="delete" aria-label="Excluir nota">
        <ion-icon name="trash"></ion-icon>
      </button>
    </div>
    <div class="meta-row">
      <input class="note-title" maxlength="80" placeholder="Título" value="${escapeAttr(note.title)}" aria-label="Título da nota" />
      <div class="date-info">
        <small class="created-at"></small>
        <small class="updated-at"></small>
      </div>
    </div>
    <input class="note-tags" maxlength="120" placeholder="Tags (separadas por vírgula)" value="${escapeAttr(note.tags.join(', '))}" aria-label="Tags da nota" />
    <div class="main"></div>
    <textarea placeholder="${getEditorPlaceholder()}"></textarea>
  `

  const main = noteEl.querySelector('.main')
  const textArea = noteEl.querySelector('textarea')
  const titleInput = noteEl.querySelector('.note-title')
  const tagsInput = noteEl.querySelector('.note-tags')
  const editBtn = noteEl.querySelector('.edit')
  const deleteBtn = noteEl.querySelector('.delete')
  const pinBtn = noteEl.querySelector('.pin')

  textArea.value = note.content
  main.innerHTML = renderText(note.content)
  updateTimestamp(noteEl, note)

  setEditMode(noteEl, !note.content, note, {
    rerenderOnSave: false,
    focusOnEdit: false,
  })

  const updateNoteFromFields = () => {
    note.title = titleInput.value.trim()
    note.content = textArea.value
    note.tags = tagsInput.value
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 10)

    note.updatedAt = Date.now()
    main.innerHTML = renderText(note.content)
    updateTimestamp(noteEl, note)
    persistNotes()
  }

  titleInput.addEventListener('input', updateNoteFromFields)
  tagsInput.addEventListener('input', updateNoteFromFields)
  textArea.addEventListener('input', updateNoteFromFields)

  editBtn.addEventListener('click', () => {
    const isEditing = !noteEl.classList.contains('editing')
    setEditMode(noteEl, isEditing, note)
  })

  pinBtn.addEventListener('click', () => {
    note.pinned = !note.pinned
    note.updatedAt = Date.now()
    persistNotes()
    renderNotes()
  })

  deleteBtn.addEventListener('click', () => {
    const canDelete = confirm('Deseja realmente excluir esta nota?')
    if (!canDelete) {
      return
    }

    removeNote(note.id)
  })

  setTimeout(() => {
    noteEl.classList.remove('fade-in')
  }, 300)

  return noteEl
}

function renderNotes() {
  const visibleNotes = filteredNotes()
  masterEl.innerHTML = ''

  visibleNotes.forEach(note => {
    masterEl.appendChild(createNoteElement(note))
  })

  updateEmptyState()
}

function createNote() {
  const timestamp = Date.now()
  const newNote = {
    id: generateId(),
    title: '',
    content: '',
    tags: [],
    pinned: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  notes.unshift(newNote)
  persistNotes()
  searchQuery = ''
  searchNotesInput.value = ''
  renderNotes()
}

function clearPendingDelete() {
  if (!pendingDelete) {
    return
  }

  clearTimeout(pendingDelete.timeoutId)
  pendingDelete = null
  undoToastEl.classList.add('hidden')
}

function removeNote(noteId) {
  clearPendingDelete()

  const index = notes.findIndex(note => note.id === noteId)
  if (index < 0) {
    return
  }

  const [removedNote] = notes.splice(index, 1)
  persistNotes()
  renderNotes()

  undoToastEl.classList.remove('hidden')

  const timeoutId = setTimeout(() => {
    pendingDelete = null
    undoToastEl.classList.add('hidden')
  }, 5000)

  pendingDelete = {
    note: removedNote,
    index,
    timeoutId,
  }
}

function undoDelete() {
  if (!pendingDelete) {
    return
  }

  clearTimeout(pendingDelete.timeoutId)
  const restoredIndex = Math.min(pendingDelete.index, notes.length)
  notes.splice(restoredIndex, 0, pendingDelete.note)
  pendingDelete = null
  undoToastEl.classList.add('hidden')
  persistNotes()
  renderNotes()
}

function exportNotes() {
  const payload = {
    exportedAt: new Date().toISOString(),
    notes,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `notes-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function importNotesFromFile(file) {
  if (!file) {
    return
  }

  try {
    const fileContent = await file.text()
    const parsed = JSON.parse(fileContent)
    const importedRaw = Array.isArray(parsed) ? parsed : parsed.notes

    if (!Array.isArray(importedRaw)) {
      throw new Error('Formato inválido')
    }

    const importedNotes = importedRaw.map(normalizeNote).filter(Boolean)

    if (!importedNotes.length) {
      alert('Arquivo sem notas válidas para importar.')
      return
    }

    const shouldReplace = confirm(
      'Deseja substituir as notas atuais pelas importadas? Clique em Cancelar para mesclar.'
    )

    const mergedNotes = shouldReplace ? importedNotes : [...importedNotes, ...notes]
    const dedupedById = new Map()

    mergedNotes.forEach(note => {
      const existing = dedupedById.get(note.id)

      if (!existing || existing.updatedAt < note.updatedAt) {
        dedupedById.set(note.id, note)
      }
    })

    notes = Array.from(dedupedById.values())
    persistNotes()
    renderNotes()
  } catch {
    alert('Não foi possível importar. Verifique se o arquivo JSON é válido.')
  } finally {
    importFileInput.value = ''
  }
}

function handleKeyboardShortcuts(event) {
  const isMac = navigator.platform.toUpperCase().includes('MAC')
  const modifierPressed = isMac ? event.metaKey : event.ctrlKey

  if (modifierPressed && event.key.toLowerCase() === 'n') {
    event.preventDefault()
    createNote()
  }

  if (modifierPressed && event.key.toLowerCase() === 's') {
    event.preventDefault()

    const noteEl = document.activeElement?.closest('.note')
    if (!noteEl) {
      return
    }

    const noteId = noteEl.dataset.noteId
    const note = notes.find(currentNote => currentNote.id === noteId)

    if (!note) {
      return
    }

    setEditMode(noteEl, false, note)
  }

  if (!modifierPressed && event.key === '/') {
    event.preventDefault()
    searchNotesInput.focus()
  }
}

function initEvents() {
  addNewNoteBtn.addEventListener('click', createNote)

  searchNotesInput.addEventListener('input', event => {
    searchQuery = event.target.value
    renderNotes()
  })

  sortNotesSelect.addEventListener('change', event => {
    sortMode = event.target.value
    renderNotes()
  })

  formatModeSelect.value = formatMode
  formatModeSelect.addEventListener('change', event => {
    formatMode = event.target.value === 'markdown' ? 'markdown' : 'whatsapp'
    localStorage.setItem('notes_format_mode', formatMode)
    renderNotes()
  })

  exportNotesBtn.addEventListener('click', exportNotes)

  importNotesBtn.addEventListener('click', () => {
    importFileInput.click()
  })

  importFileInput.addEventListener('change', event => {
    const [file] = event.target.files
    importNotesFromFile(file)
  })

  undoDeleteBtn.addEventListener('click', undoDelete)

  const logo = document.querySelector('.logo')
  logo.addEventListener('click', () => {
    location.reload()
  })

  document.addEventListener('keydown', handleKeyboardShortcuts)
}

initEvents()
renderNotes()
