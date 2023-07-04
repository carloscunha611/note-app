const addNewNoteBtn = document.querySelector('.addNewNote')
const masterEl = document.querySelector('.master')
const notes = JSON.parse(localStorage.getItem('notes')) || []

// Função para criar uma nova nota
function newNote(text = '') {
  const note = document.createElement('section')
  note.classList.add('note', 'fade-in')
  note.innerHTML = `
    <div class="tools">
      <button class="edit">
        <ion-icon name="create"></ion-icon>
      </button>
      <button class="delete">
        <ion-icon name="trash"></ion-icon>
      </button>
    </div>
    <div class="main ${text ? '' : 'hidden'}"></div>
    <textarea class="${
      text ? 'hidden' : ''
    }" placeholder="Digite aqui suas anotações.\nSuporta markdown, Exemplos:\n\n # Titulo 1 | ## Titulo 2 | - Lista | [Nome do site]link | *Itálico* | **Negrito** | <br> Quebrar linha"></textarea>
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
    removeNote(note)

    setTimeout(() => {
      note.remove()
      updateLS()
    }, 300)
  })

  textArea.addEventListener('input', e => {
    const { value } = e.target
    main.innerHTML = marked(value)
    updateLS()
  })

  masterEl.appendChild(note)

  setTimeout(() => {
    note.classList.remove('fade-in')
  }, 300)
}

function removeNote(note) {
  note.classList.toggle('fade-out')

  setTimeout(() => {
    note.remove()
    updateLS()
  }, 300)
}

// Função para atualizar o armazenamento local
function updateLS() {
  const notesTxt = document.querySelectorAll('textarea')
  const notes = []

  notesTxt.forEach(note => {
    notes.push(note.value)
  })

  localStorage.setItem('notes', JSON.stringify(notes))
}

// Carregar notas existentes do armazenamento local
if (notes.length > 0) {
  notes.forEach(note => {
    newNote(note)
  })
}

// Adicionar evento de clique ao botão de adicionar nova nota
addNewNoteBtn.addEventListener('click', () => {
  newNote()
})

// Adicionar evento de clique ao logo para recarregar a página
const logo = document.querySelector('.logo')
logo.addEventListener('click', () => {
  location.reload()
})
