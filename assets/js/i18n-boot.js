import i18n from './i18n.js';

const PHRASES = {
  en: {
    'Accueil': 'Home',
    'Catalogue': 'Catalog',
    'Bibliothèque': 'Library',
    'Romans': 'Novels',
    'Poésie': 'Poetry',
    'Contes': 'Tales',
    'Communautés': 'Communities',
    'Abonnements': 'Subscriptions',
    'Tarifs': 'Plans',
    'Publier': 'Publish',
    'Publier une œuvre': 'Publish a work',
    'Connexion': 'Log in',
    'Déconnexion': 'Log out',
    'S\'inscrire': 'Sign up',
    'À propos': 'About',
    'En savoir plus →': 'Learn more →',
    'Tout voir →': 'See all →',
    'Tous les auteurs →': 'All authors →',
    'Pourquoi Kalamundi ?': 'Why Kalamundi?',
    'Œuvres du moment': 'Trending works',
    'Nouvelles publications': 'New publications',
    'Explorer par genre': 'Explore by genre',
    '✨ Nouveaux talents': '✨ New talents',
    '📝 Leurs premières œuvres': '📝 Their first works',
    'Vous êtes auteur ?': 'Are you an author?',
    'Commencer à publier': 'Start publishing',
    'Lire': 'Read',
    'Créer': 'Create',
    'Légal': 'Legal',
    'Œuvres gratuites': 'Free works',
    'Œuvres premium': 'Premium works',
    'Créer une communauté': 'Create a community',
    'Devenir auteur': 'Become an author',
    'Confidentialité': 'Privacy',
    'Contrat auteur': 'Author agreement',
    'Droits d\'auteur': 'Copyright',
    'Mode hors-ligne': 'Offline mode',
    'Ma bibliothèque': 'My library',
    'Mon profil': 'My profile',
    'Tableau de bord': 'Dashboard',
  },
  es: {
    'Accueil': 'Inicio', 'Catalogue': 'Catálogo', 'Bibliothèque': 'Biblioteca', 'Romans': 'Novelas',
    'Poésie': 'Poesía', 'Contes': 'Cuentos', 'Communautés': 'Comunidades', 'Abonnements': 'Suscripciones',
    'Tarifs': 'Planes', 'Publier': 'Publicar', 'Publier une œuvre': 'Publicar una obra', 'Connexion': 'Iniciar sesión',
    'Déconnexion': 'Cerrar sesión', 'S\'inscrire': 'Registrarse', 'À propos': 'Acerca de', 'En savoir plus →': 'Saber más →',
    'Tout voir →': 'Ver todo →', 'Tous les auteurs →': 'Todos los autores →', 'Pourquoi Kalamundi ?': '¿Por qué Kalamundi?',
    'Œuvres du moment': 'Obras destacadas', 'Nouvelles publications': 'Nuevas publicaciones', 'Explorer par genre': 'Explorar por género',
    '✨ Nouveaux talents': '✨ Nuevos talentos', '📝 Leurs premières œuvres': '📝 Sus primeras obras',
    'Vous êtes auteur ?': '¿Eres autor?', 'Commencer à publier': 'Empezar a publicar', 'Lire': 'Leer', 'Créer': 'Crear',
    'Légal': 'Legal', 'Œuvres gratuites': 'Obras gratis', 'Œuvres premium': 'Obras premium', 'Créer une communauté': 'Crear una comunidad',
    'Devenir auteur': 'Ser autor', 'Confidentialité': 'Privacidad', 'Contrat auteur': 'Contrato de autor', 'Droits d\'auteur': 'Derechos de autor',
    'Mode hors-ligne': 'Modo sin conexión', 'Ma bibliothèque': 'Mi biblioteca', 'Mon profil': 'Mi perfil', 'Tableau de bord': 'Panel',
  },
  pt: {
    'Accueil': 'Início', 'Catalogue': 'Catálogo', 'Bibliothèque': 'Biblioteca', 'Romans': 'Romances',
    'Poésie': 'Poesia', 'Contes': 'Contos', 'Communautés': 'Comunidades', 'Abonnements': 'Assinaturas',
    'Tarifs': 'Planos', 'Publier': 'Publicar', 'Publier une œuvre': 'Publicar uma obra', 'Connexion': 'Entrar',
    'Déconnexion': 'Sair', 'S\'inscrire': 'Inscrever-se', 'À propos': 'Sobre', 'En savoir plus →': 'Saiba mais →',
    'Tout voir →': 'Ver tudo →', 'Tous les auteurs →': 'Todos os autores →', 'Pourquoi Kalamundi ?': 'Por que Kalamundi?',
    'Œuvres du moment': 'Obras em destaque', 'Nouvelles publications': 'Novas publicações', 'Explorer par genre': 'Explorar por gênero',
    '✨ Nouveaux talents': '✨ Novos talentos', '📝 Leurs premières œuvres': '📝 Suas primeiras obras',
    'Vous êtes auteur ?': 'Você é autor?', 'Commencer à publier': 'Começar a publicar', 'Lire': 'Ler', 'Créer': 'Criar',
    'Légal': 'Legal', 'Œuvres gratuites': 'Obras gratuitas', 'Œuvres premium': 'Obras premium', 'Créer une communauté': 'Criar uma comunidade',
    'Devenir auteur': 'Tornar-se autor', 'Confidentialité': 'Privacidade', 'Contrat auteur': 'Contrato do autor', 'Droits d\'auteur': 'Direitos autorais',
    'Mode hors-ligne': 'Modo offline', 'Ma bibliothèque': 'Minha biblioteca', 'Mon profil': 'Meu perfil', 'Tableau de bord': 'Painel',
  },
  de: {
    'Accueil': 'Start', 'Catalogue': 'Katalog', 'Bibliothèque': 'Bibliothek', 'Romans': 'Romane',
    'Poésie': 'Poesie', 'Contes': 'Erzählungen', 'Communautés': 'Communitys', 'Abonnements': 'Abos',
    'Tarifs': 'Tarife', 'Publier': 'Veröffentlichen', 'Publier une œuvre': 'Werk veröffentlichen', 'Connexion': 'Anmelden',
    'Déconnexion': 'Abmelden', 'S\'inscrire': 'Registrieren', 'À propos': 'Über uns', 'En savoir plus →': 'Mehr erfahren →',
    'Tout voir →': 'Alle ansehen →', 'Tous les auteurs →': 'Alle Autoren →', 'Pourquoi Kalamundi ?': 'Warum Kalamundi?',
    'Œuvres du moment': 'Aktuelle Werke', 'Nouvelles publications': 'Neue Veröffentlichungen', 'Explorer par genre': 'Nach Genre entdecken',
    '✨ Nouveaux talents': '✨ Neue Talente', '📝 Leurs premières œuvres': '📝 Ihre ersten Werke',
    'Vous êtes auteur ?': 'Sind Sie Autor?', 'Commencer à publier': 'Mit dem Veröffentlichen beginnen', 'Lire': 'Lesen', 'Créer': 'Erstellen',
    'Légal': 'Rechtliches', 'Œuvres gratuites': 'Kostenlose Werke', 'Œuvres premium': 'Premium-Werke', 'Créer une communauté': 'Community erstellen',
    'Devenir auteur': 'Autor werden', 'Confidentialité': 'Datenschutz', 'Contrat auteur': 'Autorenvertrag', 'Droits d\'auteur': 'Urheberrecht',
    'Mode hors-ligne': 'Offline-Modus', 'Ma bibliothèque': 'Meine Bibliothek', 'Mon profil': 'Mein Profil', 'Tableau de bord': 'Dashboard',
  },
  ar: {
    'Accueil': 'الرئيسية', 'Catalogue': 'الفهرس', 'Bibliothèque': 'المكتبة', 'Romans': 'روايات',
    'Poésie': 'شعر', 'Contes': 'قصص', 'Communautés': 'مجتمعات', 'Abonnements': 'اشتراكات',
    'Tarifs': 'الباقات', 'Publier': 'نشر', 'Publier une œuvre': 'نشر عمل', 'Connexion': 'تسجيل الدخول',
    'Déconnexion': 'تسجيل الخروج', 'S\'inscrire': 'إنشاء حساب', 'À propos': 'حول', 'En savoir plus →': 'اعرف المزيد ←',
    'Tout voir →': 'عرض الكل ←', 'Tous les auteurs →': 'كل المؤلفين ←', 'Pourquoi Kalamundi ?': 'لماذا كالاموندي؟',
    'Œuvres du moment': 'أعمال رائجة', 'Nouvelles publications': 'منشورات جديدة', 'Explorer par genre': 'استكشف حسب النوع',
    '✨ Nouveaux talents': '✨ مواهب جديدة', '📝 Leurs premières œuvres': '📝 أعمالهم الأولى',
    'Vous êtes auteur ?': 'هل أنت مؤلف؟', 'Commencer à publier': 'ابدأ النشر', 'Lire': 'قراءة', 'Créer': 'إنشاء',
    'Légal': 'قانوني', 'Œuvres gratuites': 'أعمال مجانية', 'Œuvres premium': 'أعمال مميزة', 'Créer une communauté': 'إنشاء مجتمع',
    'Devenir auteur': 'كن مؤلفاً', 'Confidentialité': 'الخصوصية', 'Contrat auteur': 'عقد المؤلف', 'Droits d\'auteur': 'حقوق المؤلف',
    'Mode hors-ligne': 'وضع دون اتصال', 'Ma bibliothèque': 'مكتبتي', 'Mon profil': 'ملفي', 'Tableau de bord': 'لوحة التحكم',
  },
  zh: {
    'Accueil': '首页', 'Catalogue': '目录', 'Bibliothèque': '图书馆', 'Romans': '小说',
    'Poésie': '诗歌', 'Contes': '故事', 'Communautés': '社区', 'Abonnements': '订阅',
    'Tarifs': '方案', 'Publier': '发布', 'Publier une œuvre': '发布作品', 'Connexion': '登录',
    'Déconnexion': '退出', 'S\'inscrire': '注册', 'À propos': '关于', 'En savoir plus →': '了解更多 →',
    'Tout voir →': '查看全部 →', 'Tous les auteurs →': '所有作者 →', 'Pourquoi Kalamundi ?': '为什么选择 Kalamundi？',
    'Œuvres du moment': '热门作品', 'Nouvelles publications': '最新发布', 'Explorer par genre': '按类型探索',
    '✨ Nouveaux talents': '✨ 新锐作者', '📝 Leurs premières œuvres': '📝 他们的首部作品',
    'Vous êtes auteur ?': '你是作者吗？', 'Commencer à publier': '开始发布', 'Lire': '阅读', 'Créer': '创作',
    'Légal': '法律', 'Œuvres gratuites': '免费作品', 'Œuvres premium': '高级作品', 'Créer une communauté': '创建社区',
    'Devenir auteur': '成为作者', 'Confidentialité': '隐私', 'Contrat auteur': '作者协议', 'Droits d\'auteur': '版权',
    'Mode hors-ligne': '离线模式', 'Ma bibliothèque': '我的图书馆', 'Mon profil': '我的资料', 'Tableau de bord': '仪表板',
  },
};

const FALLBACK_TO_EN = new Set(['hi', 'ja', 'ko', 'sw']);
const BASE_LANG = 'fr';

function traductionPhrase(texte) {
  if (i18n.langue === BASE_LANG) return texte;
  const table = PHRASES[i18n.langue] || (FALLBACK_TO_EN.has(i18n.langue) ? PHRASES.en : null);
  return table?.[texte] || texte;
}

function traduireTextesCommuns(root = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION'].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      const texte = node.nodeValue.trim();
      return texte && traductionPhrase(texte) !== texte
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const original = node.nodeValue.trim();
    node.nodeValue = node.nodeValue.replace(original, traductionPhrase(original));
  });
}

function installerSelecteurLangue() {
  if (document.querySelector('.js-lang-select')) return;
  const cible = document.querySelector('.navbar__actions') || document.querySelector('.topbar') || document.querySelector('.navbar__inner');
  if (!cible) return;
  cible.insertAdjacentHTML('afterbegin', i18n.renderSelecteur({ classes: 'lang-select--nav js-lang-select' }));
  connecterSelecteurs();
}

function connecterSelecteurs() {
  document.querySelectorAll('.js-lang-select').forEach(select => {
    if (select.dataset.i18nBound === '1') return;
    select.dataset.i18nBound = '1';
    select.value = i18n.langue;
    select.addEventListener('change', event => {
      i18n.setLangue(event.target.value);
      window.location.reload();
    });
  });
}

function appliquerInterface() {
  i18n.appliquer();
  traduireTextesCommuns();
  installerSelecteurLangue();
  connecterSelecteurs();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', appliquerInterface);
} else {
  appliquerInterface();
}

const observer = new MutationObserver(mutations => {
  connecterSelecteurs();
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) traduireTextesCommuns(node);
    });
  });
});

observer.observe(document.documentElement, { childList: true, subtree: true });
