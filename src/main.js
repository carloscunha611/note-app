const addNewNoteBtn = document.querySelector('.addNewNote')
const notes = JSON.parse(localStorage.getItem('notes'))

if (notes) {
  notes.forEach(note => {
    newNote(note)
  })
}

addNewNoteBtn.addEventListener('click', () => {
  newNote()
})

function newNote(text = '') {
  const note = document.createElement('section')

  note.classList.add('note')
  note.innerHTML = `
  <section class="notes">
    <div class="tools">
      <button class="edit">
        <ion-icon name="create"></ion-icon>
      </button>
      <button class="delete">
        <ion-icon name="trash"></ion-icon>
      </button>
    </div>
    <div class="main ${text ? '' : 'hidden'}"></div>
    <textarea class="${text ? 'hidden' : ''}"></textarea>
  </section>
  `
  const editBtn = note.querySelector('.edit')
  const deleteBtn = note.querySelector('.delete')
  const main = note.querySelector('.main')
  const textArea = note.querySelector('textarea')

  textArea.value = text
  main.innerHTML = marked(text)

  editBtn.addEventListener('click', () => {
    main.classList.toggle('hidden')
    textArea.classList.toggle('hidden')
  })

  deleteBtn.addEventListener('click', () => {
    note.remove()
    updateLS()
  })

  textArea.addEventListener('input', e => {
    const { value } = e.target

    main.innerHTML = marked(value)
    updateLS()
  })

  document.body.appendChild(note)
}

function updateLS() {
  const notesTxt = document.querySelectorAll('textarea')
  const notes = []

  notesTxt.forEach(note => {
    notes.push(note.value)
  })

  localStorage.setItem('notes', JSON.stringify(notes))
}
