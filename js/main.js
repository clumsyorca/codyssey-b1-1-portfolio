/* =========================================================
   이중차분법 노트: main.js
   구조: 상태(state) → 렌더 함수 → 이벤트 연결
   모든 인터랙션은 "이벤트 발생 → 상태 변경 → 화면 갱신" 순서를 따른다.
   ========================================================= */

/* ---------- 1. 설정값 ---------- */
const GITHUB_USERNAME = 'clumsyorca';
const API_URL = `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`;

const SCROLL_HEADER_THRESHOLD = 60;   // 헤더 배경이 바뀌는 스크롤 위치(px)
const SCROLL_TOP_THRESHOLD = 300;     // 맨 위로 버튼이 나타나는 스크롤 위치(px)
const REVEAL_THRESHOLD = 0.2;         // 요소의 20%가 보이면 등장 애니메이션 실행

const TYPING_PHRASES = [
  '데이터로 인과를 읽습니다',
  '상관관계는 인과관계가 아니니까요',
  '읽은 것을 다시 쓰고, 설명해 보며 확인합니다',
];

/* ---------- 2. 애플리케이션 상태 ---------- */
const state = {
  theme: 'light',        // 'light' | 'dark'
  isMenuOpen: false,     // 모바일 메뉴 열림 여부
  status: 'idle',        // 'idle' | 'loading' | 'success' | 'error' | 'empty'
  projects: [],          // GitHub에서 받아온 저장소 목록
  filter: 'all',         // 현재 선택된 언어 필터
  errorMessage: '',
};

/* ---------- 3. DOM 참조 ---------- */
const root = document.documentElement;
const header = document.querySelector('#header');
const navList = document.querySelector('#nav-list');
const navLinks = document.querySelectorAll('.nav-link');
const hamburger = document.querySelector('#hamburger');
const themeToggle = document.querySelector('#theme-toggle');
const themeIcon = document.querySelector('#theme-icon');
const scrollTopBtn = document.querySelector('#scroll-top');
const projectsGrid = document.querySelector('#projects-grid');
const filterBar = document.querySelector('#filter-bar');
const typingText = document.querySelector('#typing-text');
const contactForm = document.querySelector('#contact-form');
const formSuccess = document.querySelector('#form-success');
const sections = document.querySelectorAll('main section[id]');

/* ---------- 4. 유틸 ---------- */
/**
 * 외부에서 받아온 문자열을 HTML에 넣기 전에 특수문자를 무력화한다.
 * innerHTML에 값을 그대로 넣으면 스크립트가 실행될 수 있으므로(XSS) 반드시 거친다.
 */
const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

/* =========================================================
   흐름 ①  테마 토글 → state.theme 변경 → 전체 색상 렌더링
   ========================================================= */
const renderTheme = () => {
  root.setAttribute('data-theme', state.theme);
  themeIcon.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  themeToggle.setAttribute(
    'aria-label',
    state.theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'
  );
};

const toggleTheme = () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';   // 상태 변경
  localStorage.setItem('theme', state.theme);                // 저장 (새로고침 후 유지)
  renderTheme();                                             // 화면 갱신
};

const initTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  // 저장된 값이 있으면 그것을, 없으면 운영체제 설정을 따른다 (보너스)
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  state.theme = savedTheme ?? (prefersDark ? 'dark' : 'light');
  renderTheme();
};

/* =========================================================
   흐름 ②  햄버거 클릭 → state.isMenuOpen 변경 → 메뉴 표시
   ========================================================= */
const renderMenu = () => {
  navList.classList.toggle('active', state.isMenuOpen);
  hamburger.classList.toggle('active', state.isMenuOpen);
  hamburger.setAttribute('aria-expanded', String(state.isMenuOpen));
  hamburger.setAttribute('aria-label', state.isMenuOpen ? '메뉴 닫기' : '메뉴 열기');
};

const toggleMenu = () => {
  state.isMenuOpen = !state.isMenuOpen;
  renderMenu();
};

const closeMenu = () => {
  if (!state.isMenuOpen) return;
  state.isMenuOpen = false;
  renderMenu();
};

/* =========================================================
   스크롤 처리: 헤더 배경 / 맨 위로 버튼 / 현재 섹션 표시
   ========================================================= */
const handleScroll = () => {
  const y = window.scrollY;

  header.classList.toggle('scrolled', y > SCROLL_HEADER_THRESHOLD);
  scrollTopBtn.classList.toggle('visible', y > SCROLL_TOP_THRESHOLD);

  // 현재 화면에 있는 섹션의 메뉴 항목을 강조
  let currentId = '';
  sections.forEach((section) => {
    if (y >= section.offsetTop - 120) {
      currentId = section.id;
    }
  });

  navLinks.forEach((link) => {
    link.classList.toggle('current', link.getAttribute('href') === `#${currentId}`);
  });
};

/* =========================================================
   스크롤 등장 애니메이션 (Intersection Observer)
   ========================================================= */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);   // 한 번만 실행
      }
    });
  },
  { threshold: REVEAL_THRESHOLD }
);

const observeReveals = (scope = document) => {
  scope.querySelectorAll('.reveal:not(.visible)').forEach((el) => revealObserver.observe(el));
};

/* =========================================================
   타이핑 효과 (보너스)
   ========================================================= */
const startTypingEffect = () => {
  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  const tick = () => {
    const phrase = TYPING_PHRASES[phraseIndex];
    charIndex = isDeleting ? charIndex - 1 : charIndex + 1;
    typingText.textContent = phrase.slice(0, charIndex);

    let delay = isDeleting ? 45 : 90;

    if (!isDeleting && charIndex === phrase.length) {
      delay = 2000;               // 다 쓰고 잠시 멈춤
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % TYPING_PHRASES.length;
      delay = 400;
    }

    window.setTimeout(tick, delay);
  };

  tick();
};

/* =========================================================
   흐름 ③  API 호출 → state.status 변경 → Projects 섹션 렌더링
   상태는 loading / success / error / empty 네 가지
   ========================================================= */

/** 저장소 객체 하나를 카드 HTML 문자열로 변환한다. */
const createProjectCard = ({ name, html_url, description, language, stargazers_count, forks_count }) => `
  <article class="project-card reveal">
    <h3 class="project-title">${escapeHtml(name)}</h3>
    <p class="project-desc">${escapeHtml(description ?? '설명이 등록되지 않은 저장소입니다.')}</p>
    <div class="project-meta">
      <span class="project-lang">${escapeHtml(language ?? '기타')}</span>
      <span>⭐ ${stargazers_count}</span>
      <span>🍴 ${forks_count}</span>
    </div>
    <a class="project-link" href="${escapeHtml(html_url)}" target="_blank" rel="noopener noreferrer">
      코드 보기 →
    </a>
  </article>
`;

/** 현재 필터를 적용한 저장소 목록을 돌려준다. */
const getVisibleProjects = () =>
  state.filter === 'all'
    ? state.projects
    : state.projects.filter((repo) => (repo.language ?? '기타') === state.filter);

/** 언어 필터 버튼을 만든다 (보너스). */
const renderFilterBar = () => {
  if (state.status !== 'success') {
    filterBar.innerHTML = '';
    return;
  }

  // 중복 없는 언어 목록 추출
  const languages = [...new Set(state.projects.map((repo) => repo.language ?? '기타'))].sort();
  const options = ['all', ...languages];

  filterBar.innerHTML = options
    .map((lang) => {
      const label = lang === 'all' ? `전체 (${state.projects.length})` : lang;
      const isActive = state.filter === lang ? ' active' : '';
      return `<button type="button" class="filter-btn${isActive}" data-lang="${escapeHtml(lang)}">${escapeHtml(label)}</button>`;
    })
    .join('');

  // 방금 만든 버튼들에 이벤트를 연결한다 (동적 생성 요소이므로 여기서 연결)
  filterBar.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.lang;   // 상태 변경
      renderProjects();                  // 화면 갱신
      renderFilterBar();
    });
  });
};

/** state.status 값에 따라 Projects 섹션을 그린다. */
const renderProjects = () => {
  if (state.status === 'loading') {
    projectsGrid.innerHTML = `
      <div class="state-box">
        <div class="spinner" role="status" aria-label="불러오는 중"></div>
        <p class="state-title">저장소를 불러오는 중...</p>
        <p>GitHub API에 요청하고 있습니다.</p>
      </div>
    `;
    return;
  }

  if (state.status === 'error') {
    projectsGrid.innerHTML = `
      <div class="state-box is-error">
        <p class="state-title">프로젝트를 불러올 수 없습니다</p>
        <p>${escapeHtml(state.errorMessage)}</p>
        <button type="button" class="btn btn-primary" id="retry-btn">다시 시도</button>
      </div>
    `;
    // 동적으로 만든 버튼이므로 생성 직후에 이벤트를 연결한다
    document.querySelector('#retry-btn').addEventListener('click', fetchProjects);
    return;
  }

  if (state.status === 'empty') {
    projectsGrid.innerHTML = `
      <div class="state-box">
        <p class="state-title">표시할 프로젝트가 없습니다</p>
        <p>아직 공개된 저장소가 없습니다.</p>
      </div>
    `;
    return;
  }

  if (state.status === 'success') {
    const visible = getVisibleProjects();

    if (visible.length === 0) {
      projectsGrid.innerHTML = `
        <div class="state-box">
          <p class="state-title">조건에 맞는 프로젝트가 없습니다</p>
          <p>다른 언어 필터를 선택해 보세요.</p>
        </div>
      `;
      return;
    }

    projectsGrid.innerHTML = visible.map(createProjectCard).join('');
    observeReveals(projectsGrid);   // 새로 만든 카드에도 등장 애니메이션 적용
  }
};

/** GitHub API를 호출하고 상태를 갱신한다. */
const fetchProjects = async () => {
  state.status = 'loading';
  renderProjects();
  renderFilterBar();

  try {
    const response = await fetch(API_URL);

    // fetch는 404·403이어도 예외를 던지지 않으므로 직접 확인해야 한다
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('GitHub API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요. (403)');
      }
      if (response.status === 404) {
        throw new Error(`'${GITHUB_USERNAME}' 사용자를 찾을 수 없습니다. (404)`);
      }
      throw new Error(`요청에 실패했습니다. (HTTP ${response.status})`);
    }

    const data = await response.json();
    const repos = data.filter((repo) => !repo.fork);   // 포크한 저장소는 제외

    if (repos.length === 0) {
      state.projects = [];
      state.status = 'empty';
    } else {
      state.projects = repos;
      state.filter = 'all';
      state.status = 'success';
    }
  } catch (error) {
    console.error('[fetchProjects]', error);
    state.status = 'error';
    state.errorMessage = error.message ?? '네트워크 연결을 확인해 주세요.';
  }

  renderProjects();
  renderFilterBar();
};

/* =========================================================
   흐름 ④  폼 제출 → 검증 결과(errors) 변경 → 에러 메시지 렌더링
   ========================================================= */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const showFieldError = (fieldId, message) => {
  document.querySelector(`#${fieldId}`).classList.add('invalid');
  document.querySelector(`#${fieldId}-error`).textContent = message;
};

const clearFieldError = (fieldId) => {
  document.querySelector(`#${fieldId}`).classList.remove('invalid');
  document.querySelector(`#${fieldId}-error`).textContent = '';
};

/** 필드 하나를 검사해 통과 여부를 돌려준다. */
const validateField = (fieldId) => {
  const value = document.querySelector(`#${fieldId}`).value.trim();

  if (fieldId === 'name') {
    if (value === '') {
      showFieldError('name', '이름을 입력해 주세요.');
      return false;
    }
  }

  if (fieldId === 'email') {
    if (value === '') {
      showFieldError('email', '이메일을 입력해 주세요.');
      return false;
    }
    if (!EMAIL_PATTERN.test(value)) {
      showFieldError('email', '올바른 이메일 형식이 아닙니다. (예: you@example.com)');
      return false;
    }
  }

  if (fieldId === 'message') {
    if (value === '') {
      showFieldError('message', '메시지를 입력해 주세요.');
      return false;
    }
    if (value.length < 10) {
      showFieldError('message', `10자 이상 입력해 주세요. (현재 ${value.length}자)`);
      return false;
    }
  }

  clearFieldError(fieldId);
  return true;
};

const handleSubmit = (event) => {
  event.preventDefault();          // 페이지 새로고침(기본 동작) 차단

  const fields = ['name', 'email', 'message'];
  const results = fields.map((fieldId) => validateField(fieldId));
  const isValid = results.every((ok) => ok);

  if (!isValid) {
    formSuccess.textContent = '';
    return;
  }

  const { value: userName } = document.querySelector('#name');
  formSuccess.textContent = `${userName}님, 메시지가 정상적으로 확인되었습니다. 감사합니다!`;
  contactForm.reset();

  window.setTimeout(() => {
    formSuccess.textContent = '';
  }, 5000);
};

/* =========================================================
   이벤트 연결 및 초기화
   ========================================================= */
const bindEvents = () => {
  themeToggle.addEventListener('click', toggleTheme);
  hamburger.addEventListener('click', toggleMenu);

  // 메뉴 항목을 클릭하면 모바일 메뉴를 닫는다
  navLinks.forEach((link) => link.addEventListener('click', closeMenu));

  window.addEventListener('scroll', handleScroll, { passive: true });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  contactForm.addEventListener('submit', handleSubmit);

  // 입력 중 실시간 피드백: 에러가 떠 있던 필드만 다시 검사
  ['name', 'email', 'message'].forEach((fieldId) => {
    document.querySelector(`#${fieldId}`).addEventListener('input', (event) => {
      if (event.target.classList.contains('invalid')) {
        validateField(fieldId);
      }
    });
  });

  // 데스크톱 폭으로 넓어지면 열려 있던 모바일 메뉴를 정리한다
  window.matchMedia('(min-width: 768px)').addEventListener('change', (event) => {
    if (event.matches) closeMenu();
  });
};

const init = () => {
  initTheme();
  renderMenu();
  bindEvents();
  handleScroll();
  observeReveals();
  startTypingEffect();
  fetchProjects();
};

init();
