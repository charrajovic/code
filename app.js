// DOM Elements
const homeScreen = document.getElementById('home-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultsScreen = document.getElementById('results-screen');
const seriesInput = document.getElementById('series-input');
const startBtn = document.getElementById('start-btn');
const examBtn = document.getElementById('exam-btn');
const errorMsg = document.getElementById('error-msg');

const currentSeriesDisplay = document.getElementById('current-series-display');
const questionNumber = document.getElementById('question-number');
const questionImage = document.getElementById('question-image');
const optionBtns = document.querySelectorAll('.option-btn');
const nextBtn = document.getElementById('next-btn');

const finalScore = document.getElementById('final-score');
const correctionList = document.getElementById('correction-list');
const restartBtn = document.getElementById('restart-btn');
const nextSeriesBtn = document.getElementById('next-series-btn');
const filterBtn = document.getElementById('filter-btn');

const imageModal = document.getElementById('image-modal');
const zoomedImage = document.getElementById('zoomed-image');

// State
let currentSeriesData = null;
let currentQuestionIndex = 0;
let userAnswers = []; // Array of arrays, e.g., [[1], [2, 3], ...]
let currentSelection = []; // Selection for the active question
let showingOnlyErrors = false;

// Event Listeners
startBtn.addEventListener('click', startSeries);
examBtn.addEventListener('click', startRandomExam);
nextBtn.addEventListener('click', handleNextQuestion);
restartBtn.addEventListener('click', resetApp);
if (nextSeriesBtn) nextSeriesBtn.addEventListener('click', startNextSeries);
filterBtn.addEventListener('click', toggleFilter);

optionBtns.forEach(btn => {
  btn.addEventListener('click', () => toggleOption(parseInt(btn.dataset.value)));
});

seriesInput.addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    startSeries();
  }
});

// Raccourcis clavier (Zoom et Quiz)
document.addEventListener('keyup', function (e) {
  // Raccourcis globaux pour l'image
  if (e.key === 'Escape') {
    closeZoom();
  } else if (e.key === '²' || e.code === 'Backquote') {
    if (imageModal.classList.contains('hidden')) {
      if (quizScreen.classList.contains('active')) {
        openZoom();
      }
    } else {
      closeZoom();
    }
  }

  // Raccourcis spécifiques au quiz
  if (!quizScreen.classList.contains('active')) return;
  switch (e.code) {
    case 'Digit1': case 'Numpad1': toggleOption(1); break;
    case 'Digit2': case 'Numpad2': toggleOption(2); break;
    case 'Digit3': case 'Numpad3': toggleOption(3); break;
    case 'Digit4': case 'Numpad4': toggleOption(4); break;
    case 'Enter': case 'NumpadEnter': handleNextQuestion(); break;
  }
});

// Functions
async function startSeries() {
  const seriesNum = seriesInput.value.trim();
  console.log(seriesNum);
  if (!seriesNum) return;

  errorMsg.classList.add('hidden');
  startBtn.textContent = 'Chargement...';
  startBtn.disabled = true;

  try {
    const response = await fetch(`${seriesNum}/series.json`);
    if (!response.ok) throw new Error('Series not found');

    const data = await response.json();

    // Sort questions by index just in case
    data.questions.sort((a, b) => a.index - b.index);

    currentSeriesData = data;
    currentSeriesData.folderNumber = seriesNum; // Keep track of the folder for images

    initQuiz();
  } catch (error) {
    errorMsg.classList.remove('hidden');
    startBtn.textContent = 'Commencer le Test';
    startBtn.disabled = false;
  }
}

async function startRandomExam() {
  errorMsg.classList.add('hidden');
  examBtn.textContent = 'Chargement...';
  examBtn.disabled = true;

  try {
    let allQuestions = [];
    const maxFoldersToCheck = 50; // Check folders from 1 to 50
    const fetchPromises = [];

    // Parallel fetch to discover available series and get their data
    for (let i = 1; i <= maxFoldersToCheck; i++) {
      fetchPromises.push(
        fetch(`${i}/series.json`)
          .then(async response => {
            if (response.ok) {
              const data = await response.json();
              return data.questions.map(q => ({
                ...q,
                folderNumber: i.toString()
              }));
            }
            return null;
          })
          .catch(() => null)
      );
    }

    const results = await Promise.all(fetchPromises);

    for (const questions of results) {
      if (questions) {
        allQuestions = allQuestions.concat(questions);
      }
    }

    if (allQuestions.length === 0) throw new Error('No questions found');

    // Shuffle the questions array
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }

    // Select the first 40 questions
    const selectedQuestions = allQuestions.slice(0, 40);

    currentSeriesData = {
      number: 'Blanc (Aléatoire)',
      questions: selectedQuestions,
      isRandom: true
    };

    initQuiz();
  } catch (error) {
    errorMsg.classList.remove('hidden');
    errorMsg.textContent = "Erreur lors du chargement de l'examen blanc.";
  } finally {
    examBtn.textContent = 'Examen Blanc (40 Q. Aléatoires)';
    examBtn.disabled = false;
  }
}

function initQuiz() {
  userAnswers = [];
  currentQuestionIndex = 0;

  homeScreen.classList.remove('active');
  homeScreen.classList.add('hidden');

  quizScreen.classList.remove('hidden');
  quizScreen.classList.add('active');

  currentSeriesDisplay.textContent = currentSeriesData.number || currentSeriesData.folderNumber;

  loadQuestion();
}

function loadQuestion() {
  if (currentQuestionIndex >= currentSeriesData.questions.length || currentQuestionIndex >= 40) {
    showResults();
    return;
  }

  const question = currentSeriesData.questions[currentQuestionIndex];
  currentSelection = [];

  // Update UI
  questionNumber.textContent = currentQuestionIndex + 1;

  // Some json might have 'photoUri' like 'photos/q01.jpg'
  // Use question.folderNumber if available (for random exam), else fallback to series folder
  const folder = question.folderNumber || currentSeriesData.folderNumber;
  const imgPath = `${folder}/${question.photoUri}`;
  questionImage.src = imgPath;

  // Reset buttons
  optionBtns.forEach(btn => btn.classList.remove('selected'));
  nextBtn.disabled = true;
  nextBtn.style.opacity = '0.5';
  nextBtn.style.cursor = 'not-allowed';
}

function toggleOption(value) {
  const btn = document.querySelector(`.option-btn[data-value="${value}"]`);

  if (currentSelection.includes(value)) {
    currentSelection = currentSelection.filter(v => v !== value);
    btn.classList.remove('selected');
  } else {
    currentSelection.push(value);
    btn.classList.add('selected');
  }

  currentSelection.sort((a, b) => a - b);

  // Enable/disable next button
  if (currentSelection.length > 0) {
    nextBtn.disabled = false;
    nextBtn.style.opacity = '1';
    nextBtn.style.cursor = 'pointer';
  } else {
    nextBtn.disabled = true;
    nextBtn.style.opacity = '0.5';
    nextBtn.style.cursor = 'not-allowed';
  }
}

function handleNextQuestion() {
  if (currentSelection.length === 0) return; // Empêcher de passer si aucune réponse

  userAnswers.push([...currentSelection]);

  currentQuestionIndex++;
  loadQuestion();
}

function showResults() {
  quizScreen.classList.remove('active');
  quizScreen.classList.add('hidden');

  resultsScreen.classList.remove('hidden');
  resultsScreen.classList.add('active');

  calculateAndRenderCorrection();

  if (currentSeriesData && !currentSeriesData.isRandom && currentSeriesData.folderNumber && !isNaN(parseInt(currentSeriesData.folderNumber))) {
    if (nextSeriesBtn) {
      nextSeriesBtn.classList.remove('hidden');
      nextSeriesBtn.style.display = 'inline-block';
      nextSeriesBtn.textContent = `Série suivante (${parseInt(currentSeriesData.folderNumber) + 1})`;
    }
  } else {
    if (nextSeriesBtn) {
      nextSeriesBtn.classList.add('hidden');
      nextSeriesBtn.style.display = 'none';
    }
  }
}

function startNextSeries() {
  if (currentSeriesData && currentSeriesData.folderNumber) {
    const nextNum = parseInt(currentSeriesData.folderNumber) + 1;
    seriesInput.value = nextNum;
    resetApp();
    startSeries();
  }
}

function calculateAndRenderCorrection() {
  let score = 0;
  correctionList.innerHTML = '';

  // Process up to 40 questions
  const totalQuestions = Math.min(currentSeriesData.questions.length, 40);

  for (let i = 0; i < totalQuestions; i++) {
    const question = currentSeriesData.questions[i];
    const userAns = userAnswers[i] || [];
    const correctAns = question.correct || []; // Use 'correct' based on user request

    // Sort both arrays to compare
    const sortedUserAns = [...userAns].sort();
    const sortedCorrectAns = [...correctAns].sort();

    const isCorrect = JSON.stringify(sortedUserAns) === JSON.stringify(sortedCorrectAns);

    if (isCorrect) score++;

    // Create correction item UI
    const item = document.createElement('div');
    item.className = `correction-item ${isCorrect ? 'correct' : 'wrong'}`;

    const folder = question.folderNumber || currentSeriesData.folderNumber;
    const imgPath = `${folder}/${question.photoUri}`;

    // Using loading="lazy" to fix page slowness
    item.innerHTML = `
      <img src="${imgPath}" alt="Q${i + 1}" loading="lazy" onclick="openZoomFromSrc('${imgPath}')">
      <div class="correction-details">
        <h4>Question ${i + 1}</h4>
        <p>Vos réponses: ${userAns.length > 0 ? userAns.join(', ') : 'Aucune'} 
           ${isCorrect ? '<span class="badge success">Correct</span>' : '<span class="badge error">Faux</span>'}
        </p>
        ${!isCorrect ? `<p>Réponses exactes: <strong>${correctAns.join(', ')}</strong></p>` : ''}
      </div>
    `;

    correctionList.appendChild(item);
  }

  finalScore.textContent = score;
}

function resetApp() {
  resultsScreen.classList.remove('active');
  resultsScreen.classList.add('hidden');

  homeScreen.classList.remove('hidden');
  homeScreen.classList.add('active');

  seriesInput.value = '';
  startBtn.textContent = 'Commencer le Test';
  startBtn.disabled = false;
  examBtn.textContent = 'Examen Blanc (40 Q. Aléatoires)';
  examBtn.disabled = false;
  showingOnlyErrors = false;
  filterBtn.textContent = 'Afficher uniquement les erreurs';
}

function toggleFilter() {
  showingOnlyErrors = !showingOnlyErrors;
  const items = document.querySelectorAll('.correction-item');

  if (showingOnlyErrors) {
    filterBtn.textContent = 'Afficher toutes les questions';
    items.forEach(item => {
      if (item.classList.contains('correct')) {
        item.style.display = 'none';
      }
    });
  } else {
    filterBtn.textContent = 'Afficher uniquement les erreurs';
    items.forEach(item => {
      item.style.display = 'flex';
    });
  }
}

// Modal Zoom Functions
let isZoomed = false;
const ZOOM_FACTOR = 2.5; // Change this to modify zoom level (e.g. 2, 3, etc.)

function openZoom() {
  if (questionImage.src) {
    zoomedImage.src = questionImage.src;
    imageModal.classList.remove('hidden');
    resetZoomState();
  }
}

function openZoomFromSrc(src) {
  zoomedImage.src = src;
  imageModal.classList.remove('hidden');
  resetZoomState();
}

function resetZoomState() {
  isZoomed = false;
  zoomedImage.style.transform = `scale(1)`;
  zoomedImage.style.cursor = 'zoom-in';
}

function closeZoom() {
  imageModal.classList.add('hidden');
}

// Click to zoom at specific point, double click or second click to unzoom
zoomedImage.addEventListener('click', function (e) {
  if (isZoomed) {
    resetZoomState();
  } else {
    const rect = zoomedImage.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    zoomedImage.style.transformOrigin = `${x}% ${y}%`;
    zoomedImage.style.transform = `scale(${ZOOM_FACTOR})`;
    zoomedImage.style.cursor = 'zoom-out';
    isZoomed = true;
  }
});

// Double click to unzoom as well just in case
zoomedImage.addEventListener('dblclick', function (e) {
  resetZoomState();
});

// Close modal when clicking outside the image
imageModal.addEventListener('click', function (e) {
  if (e.target === imageModal) {
    closeZoom();
  }
});