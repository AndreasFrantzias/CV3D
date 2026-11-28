// what's drawn on the two screens in the room: canvas drawings that App.jsx turns into the screens' glow textures

// the "Popular repositories" cards on the monitor's GitHub page (the live repo list is in the Projects window)
const PINNED = [
  { name: 'andreasfrantzias.github.io' },
  { name: 'Side-projects', description: 'A few of the side projects that i started in my university', language: 'C' },
  { name: 'Website-for-3D-printed-items', language: 'JavaScript' },
  { name: 'ProtectTheSouvla' },
  { name: 'CV3D', language: 'JavaScript' },
  { name: 'TEDI' },
]
const LANGUAGE_COLORS = { JavaScript: '#f1e05a', TypeScript: '#3178c6', C: '#555555' }

const font = (size, weight = 400) => `${weight} ${size}px system-ui, sans-serif`

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let line = ''
  for (const word of text.split(' ')) {
    if (line && ctx.measureText(`${line} ${word}`).width > maxWidth) {
      ctx.fillText(line, x, y)
      line = word
      y += lineHeight
    } else line = line ? `${line} ${word}` : word
  }
  ctx.fillText(line, x, y)
}

// the laptop: a low-poly dusk wallpaper (to match the room) with a dock of app icons
export function drawDesktop(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#2b1b5a')
  sky.addColorStop(0.55, '#c0587e')
  sky.addColorStop(1, '#f6b48f')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#ffd9a0'
  ctx.beginPath()
  ctx.arc(w * 0.68, h * 0.5, h * 0.11, 0, Math.PI * 2)
  ctx.fill()

  // three jagged mountain ranges, darker toward the front
  ;['#8a4a80', '#57306a', '#2a1a3e'].forEach((color, layer) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let i = 0; i <= 10; i++) {
      const peak = i % 2 ? (((i * 7 + layer * 3) % 5) + 1) * 0.035 : 0 // every other point is a peak, of varying height
      ctx.lineTo((w / 10) * i, h * (0.55 + layer * 0.11 - peak))
    }
    ctx.lineTo(w, h)
    ctx.fill()
  })

  // the dock
  const ICONS = ['#4493f8', '#2ea043', '#f78166', '#e3b341', '#a371f7', '#e6edf3']
  const size = 54, gap = 14, dockWidth = ICONS.length * (size + gap) + gap
  ctx.fillStyle = 'rgb(255 255 255 / 0.25)'
  ctx.beginPath()
  ctx.roundRect((w - dockWidth) / 2, h - size - 2 * gap - 10, dockWidth, size + 2 * gap, 22)
  ctx.fill()
  ICONS.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect((w - dockWidth) / 2 + gap + i * (size + gap), h - size - gap - 10, size, size, 14)
    ctx.fill()
  })
}

// the monitor: a dark-theme GitHub profile page; laid out for a 1024-wide canvas about 700 tall
export function drawGitHubProfile(ctx, w, h, user, bio) {
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, w, h)
  ctx.textBaseline = 'middle'

  // header and tabs
  ctx.fillStyle = '#010409'
  ctx.fillRect(0, 0, w, 120)
  ctx.fillStyle = '#e6edf3'
  ctx.beginPath()
  ctx.arc(44, 36, 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = font(22, 600)
  ctx.fillText(user, 76, 36)
  ctx.font = font(18)
  let x = 28
  for (const [i, tab] of ['Overview', 'Repositories', 'Projects', 'Packages', 'Stars'].entries()) {
    ctx.fillStyle = i === 0 ? '#e6edf3' : '#9198a1'
    ctx.fillText(tab, x, 92)
    const width = ctx.measureText(tab).width
    if (i === 0) {
      ctx.fillStyle = '#f78166'
      ctx.fillRect(x - 6, 116, width + 12, 3)
    }
    x += width + 34
  }
  ctx.fillStyle = '#30363d'
  ctx.fillRect(0, 119, w, 1)

  // avatar: the identicon from the profile, clipped to a circle
  ctx.save()
  ctx.beginPath()
  ctx.arc(160, 255, 115, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(45, 140, 230, 230)
  ctx.fillStyle = '#b569cc'
  const IDENTICON = ['11111', '00000', '00100', '00000', '11011']
  IDENTICON.forEach((row, r) => [...row].forEach((cell, c) => cell === '1' && ctx.fillRect(65 + c * 38, 160 + r * 38, 38, 38)))
  ctx.restore()
  ctx.fillStyle = '#9198a1'
  ctx.font = font(24)
  ctx.fillText(user, 45, 400)
  ctx.fillStyle = '#e6edf3'
  ctx.font = font(17)
  wrapText(ctx, bio, 45, 440, 240, 24)

  // pinned repo cards, two columns
  ctx.fillStyle = '#e6edf3'
  ctx.font = font(20)
  ctx.fillText('Popular repositories', 330, 155)
  PINNED.forEach((repo, i) => {
    const cardX = 330 + (i % 2) * 336, cardY = 180 + Math.floor(i / 2) * 120
    ctx.strokeStyle = '#30363d'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cardX, cardY, 320, 106, 8)
    ctx.stroke()
    ctx.fillStyle = '#4493f8'
    ctx.font = font(17, 600)
    ctx.fillText(repo.name, cardX + 16, cardY + 26, 228) // squeezed if needed to stay clear of the Public pill
    ctx.beginPath()
    ctx.roundRect(cardX + 252, cardY + 14, 54, 24, 12)
    ctx.stroke()
    ctx.fillStyle = '#9198a1'
    ctx.font = font(13)
    ctx.fillText('Public', cardX + 260, cardY + 27)
    if (repo.description) {
      ctx.font = font(14)
      wrapText(ctx, repo.description, cardX + 16, cardY + 54, 288, 18)
    }
    if (repo.language) {
      ctx.fillStyle = LANGUAGE_COLORS[repo.language]
      ctx.beginPath()
      ctx.arc(cardX + 23, cardY + 88, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#9198a1'
      ctx.font = font(14)
      ctx.fillText(repo.language, cardX + 38, cardY + 89)
    }
  })

  // contribution graph: a year of days as squares, shaded at random
  ctx.fillStyle = '#e6edf3'
  ctx.font = font(18)
  ctx.fillText('Contributions in the last year', 330, 555)
  const SHADES = ['#151b23', '#151b23', '#151b23', '#033a16', '#196c2e', '#2ea043', '#56d364']
  for (let week = 0; week < 52; week++) {
    for (let day = 0; day < 7; day++) {
      ctx.fillStyle = SHADES[Math.floor(Math.random() ** 1.5 * SHADES.length)] // ** 1.5: mostly empty days, a few busy ones
      ctx.fillRect(330 + week * 12.6, 580 + day * 12.6, 10, 10)
    }
  }
}
