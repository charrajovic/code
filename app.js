// DOM Elements
const homeScreen = document.getElementById('home-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultsScreen = document.getElementById('results-screen');
const seriesInput = document.getElementById('series-input');
const startBtn = document.getElementById('start-btn');
const errorMsg = document.getElementById('error-msg');

const currentSeriesDisplay = document.getElementById('current-series-display');
const questionNumber = document.getElementById('question-number');
const questionImage = document.getElementById('question-image');
const optionBtns = document.querySelectorAll('.option-btn');
const nextBtn = document.getElementById('next-btn');

const finalScore = document.getElementById('final-score');
const correctionList = document.getElementById('correction-list');
const restartBtn = document.getElementById('restart-btn');
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
nextBtn.addEventListener('click', handleNextQuestion);
restartBtn.addEventListener('click', resetApp);
filterBtn.addEventListener('click', toggleFilter);

optionBtns.forEach(btn => {
  btn.addEventListener('click', () => toggleOption(parseInt(btn.dataset.value)));
});

seriesInput.addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    startSeries();
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
  // We prepend the folder number to make it relative to root
  const imgPath = `${currentSeriesData.folderNumber}/${question.photoUri}`;
  questionImage.src = imgPath;

  // Reset buttons
  optionBtns.forEach(btn => btn.classList.remove('selected'));
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
}

function handleNextQuestion() {
  // If user selected nothing, we can either block them or assume empty array.
  // Assuming empty array is fine.
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
    
    const imgPath = `${currentSeriesData.folderNumber}/${question.photoUri}`;
    
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
zoomedImage.addEventListener('dblclick', function(e) {
  resetZoomState();
});

// Close modal when clicking outside the image
imageModal.addEventListener('click', function (e) {
  if (e.target === imageModal) {
    closeZoom();
  }
});
