const CART_KEY = 'kalamundi_cart_v1';

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]').filter(item => item?.oeuvreId);
  } catch {
    return [];
  }
}

export function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items || []));
}

export function addToCart(item) {
  const items = getCart();
  const existing = items.find(i => i.oeuvreId === item.oeuvreId);
  if (existing) {
    Object.assign(existing, item);
  } else {
    items.push(item);
  }
  saveCart(items);
  return items;
}

export function removeFromCart(oeuvreId) {
  const items = getCart().filter(item => item.oeuvreId !== oeuvreId);
  saveCart(items);
  return items;
}

export function clearCart() {
  saveCart([]);
}

export function cartTotal(items = getCart()) {
  return items.reduce((sum, item) => sum + Number(item.prix || 0), 0);
}
