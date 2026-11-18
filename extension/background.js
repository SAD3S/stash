// Ouvre Stash avec la fenêtre d'ajout pré-remplie (même chemin que le partage Android).
const APP = 'https://sad3s.github.io/stash/';
const save = (url, title = '') => {
  if (!/^https?:/.test(url || '')) return;
  browser.tabs.create({ url: `${APP}?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` });
};

browser.action.onClicked.addListener((tab) => save(tab.url, tab.title));

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({ id: 'link', title: 'Enregistrer ce lien dans Stash', contexts: ['link'] });
  browser.contextMenus.create({ id: 'page', title: 'Enregistrer cette page dans Stash', contexts: ['page', 'video'] });
});
browser.contextMenus.onClicked.addListener((info, tab) =>
  info.menuItemId === 'link' ? save(info.linkUrl, info.linkText || '') : save(tab.url, tab.title));
