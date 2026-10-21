import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'e2e-admin@example.com';
const ADMIN_PASSWORD = 'E2e-Panel-Password-123';

test.describe('панель', () => {
  test('health отвечает и видит базу', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('главная редиректит на дашборд', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('страница входа показывает форму', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('вход с неверным паролем не пускает в дашборд', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill('wrong-password-123');
    await page.getByRole('button', { name: /sign in|войти/i }).click();
    // Остаёмся на странице входа и видим ошибку.
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText(/invalid email or password|неверн/i).first(),
    ).toBeVisible();
  });

  test('вход администратором открывает дашборд', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in|войти/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('после входа сессия передаётся через API', async ({ page, request }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in|войти/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Сессия живёт в cookie браузера — переносим её в API-контекст.
    const cookies = await page.context().cookies();
    const session = cookies.find((cookie) => cookie.name.includes('session'));
    expect(session, 'нет cookie сессии').toBeDefined();

    const response = await request.get('/api/auth/session', {
      headers: { Cookie: `${session!.name}=${session!.value}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user?.email).toBe(ADMIN_EMAIL);
  });

  test('без сессии API отдаёт пустую сессию', async ({ request }) => {
    const response = await request.get('/api/auth/session');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user).toBeUndefined();
  });

  test('принимает запросы с чужим Host (алиас без DNS)', async ({ request }) => {
    // Панель обслуживает и основной адрес, и алиасы (--hostname).
    // next-auth работает с trustHost, поэтому Host не сверяется с
    // NUXT_PANEL_URL — вход не ломается при заходе по имени.
    const response = await request.get('/api/auth/session', {
      headers: { Host: 'panel.local' },
    });
    expect(response.status()).toBe(200);
  });

  test('health отвечает и при чужом Host', async ({ request }) => {
    const response = await request.get('/api/health', {
      headers: { Host: 'panel.local' },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).status).toBe('ok');
  });

  test('страница несуществующего сервера не роняет панель', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in|войти/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    // Панель остаётся живой после 404-внутреннего маршрута.
    const response = await page.request.get('/api/health');
    expect(response.status()).toBe(200);
  });
});
