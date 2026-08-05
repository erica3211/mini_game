import { chromium } from 'playwright-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'http://localhost:5173'

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
})

const context1 = await browser.newContext({ viewport: { width: 420, height: 900 } })
const context2 = await browser.newContext()
await context1.grantPermissions(['microphone'], { origin: BASE })
await context2.grantPermissions(['microphone'], { origin: BASE })

const page1 = await context1.newPage()
const page2 = await context2.newPage()

for (const [label, page] of [['P1', page1], ['P2', page2]]) {
  page.on('pageerror', (err) => console.log(`[${label} pageerror]`, err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[${label} console.error]`, msg.text())
  })
}

await page1.goto(`${BASE}/party`)
await page1.fill('.guess-input', 'P1')
await page1.click('button:has-text("방 만들기")')
await page1.waitForURL(/\/party\/.+/i)
const roomCode = page1.url().split('/').pop()
console.log('room code', roomCode)

await page2.goto(`${BASE}/party/${roomCode}`)
await page2.fill('.guess-input', 'P2')
await page2.click('button:has-text("입장하기")')

await page1.waitForSelector('.party-player-list')
await page2.waitForSelector('.party-player-list')

async function selectOnlyShoutRace(page) {
  const cards = page.locator('.party-game-card')
  const count = await cards.count()
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i)
    const title = await card.locator('.party-game-card-title').innerText()
    const pressed = await card.getAttribute('aria-pressed')
    const isShout = title.includes('샤우팅')
    if (isShout && pressed !== 'true') await card.click()
    if (!isShout && pressed === 'true') await card.click()
  }
}
await selectOnlyShoutRace(page1)

const currentRounds = Number(await page1.locator('.party-config-stepper-value').innerText())
const minusBtn = page1.locator('button[aria-label="라운드 수 줄이기"]')
for (let i = 1; i < currentRounds; i++) {
  await minusBtn.click()
  await page1.waitForTimeout(150)
}

await page2.click('button:has-text("준비 완료")')
await page1.waitForTimeout(500)
await page1.click('button:has-text("게임 시작")')

console.log('waiting for round_active...')
await page1.waitForSelector('.party-round-stage', { timeout: 10000 })
console.log('round_active reached')

// 캘리브레이션 단계: dB 미터 텍스트 확인
await page1.waitForSelector('.party-shoutrace-db-meter', { timeout: 5000 })
await page1.waitForTimeout(1500)
console.log('calibrating db meter text:', await page1.locator('.party-shoutrace-db-meter').innerText())
await page1.screenshot({ path: 'shot-1-calibrating.png' })

// 신호등 단계 감지 및 색 변화 로깅 (최대 8초 동안 폴링)
let sawCountdown = false
for (let i = 0; i < 16; i++) {
  const lightsVisible = await page1.locator('.party-shoutrace-lights').isVisible().catch(() => false)
  if (lightsVisible) {
    sawCountdown = true
    const activeIndex = await page1.locator('.party-shoutrace-light-active').getAttribute('class').catch(() => null)
    const startVisible = await page1.locator('.party-shoutrace-light-start').isVisible().catch(() => false)
    console.log(`t=${(i * 0.5).toFixed(1)}s countdown active-light-class=${activeIndex} startVisible=${startVisible}`)
    if (i === 2) await page1.screenshot({ path: 'shot-2-lights.png' })
  }
  await page1.waitForTimeout(500)
}
console.log('sawCountdown:', sawCountdown)

// 레이스 단계: 도로/차/게이지 스크린샷 + 레이스 중 dB 표시 확인
await page1.waitForSelector('.party-shoutrace-track', { timeout: 5000 }).catch(() => console.log('never reached race track UI'))
await page1.waitForTimeout(800)
console.log('racing db meter text:', await page1.locator('.party-shoutrace-db-meter').innerText().catch(() => '(not visible)'))
await page1.screenshot({ path: 'shot-3-racing.png' })
await page1.waitForTimeout(1500)
await page1.screenshot({ path: 'shot-4-racing-later.png' })

await context1.close()
await context2.close()
await browser.close()
console.log('done')
