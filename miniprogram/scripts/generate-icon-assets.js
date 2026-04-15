const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')
const { pageIcons, tabbarIcons } = require('./icons/manifest')

const projectRoot = path.join(__dirname, '..')
const weuiIconBundlePath = path.join(projectRoot, 'vendor', 'weui-miniprogram', 'icon', 'icon.js')
const iconsDir = path.join(projectRoot, 'assets', 'icons')
const legacyAntIconsDir = path.join(projectRoot, 'assets', 'ant-icons')
const tabbarDir = path.join(projectRoot, 'assets', 'tabbar')
const colorableValues = new Set(['black', '#000', '#000000', 'white', '#fff', '#ffffff', 'currentcolor'])
const weuiIconBundle = fs.readFileSync(weuiIconBundlePath, 'utf8')
const weuiIconSourceMap = (() => {
  const sourceMap = new Map()
  const iconPattern = /"?([a-z0-9-]+)"?:\{outline:'([\s\S]*?)',filled:'([\s\S]*?)'\}/g
  let match = iconPattern.exec(weuiIconBundle)

  while (match) {
    sourceMap.set(match[1], {
      outline: match[2],
      filled: match[3]
    })
    match = iconPattern.exec(weuiIconBundle)
  }

  return sourceMap
})()
const legacyAntIconAliases = {
  'arrow-left-dark': 'nav-back-dark',
  'arrow-right-blue': 'nav-forward-muted',
  'arrow-right-light': 'nav-forward-light',
  'arrow-right-muted': 'nav-forward-muted',
  'check-success': 'status-success',
  'check-white': 'checkbox-tick-inverse',
  'close-fail': 'status-fail',
  'close-muted': 'action-clear-muted',
  'customer-service-blue': 'support-primary',
  'environment-blue': 'location-primary',
  'environment-green': 'location-green',
  'environment-orange': 'location-warm',
  'environment-violet': 'location-violet',
  'environment-white': 'location-inverse',
  'loading-blue': 'status-loading-primary',
  'search-muted': 'search-muted',
  'thunderbolt-blue': 'highlight-bolt-primary',
  'user-white': 'avatar-user-inverse'
}

const ensureUniqueNames = icons => {
  const seen = new Set()

  for (const icon of icons) {
    if (seen.has(icon.name)) {
      throw new Error(`Duplicate icon name found in manifest: ${icon.name}`)
    }
    seen.add(icon.name)
  }
}

const loadSourceSvg = icon => {
  if (!icon.icon) {
    throw new Error(`Icon manifest item "${icon.name}" must provide a valid weui-miniprogram icon key`)
  }

  const variants = weuiIconSourceMap.get(icon.icon)

  if (!variants) {
    throw new Error(`Missing weui-miniprogram icon source: ${icon.icon}`)
  }

  const type = icon.type === 'filled' ? 'filled' : 'outline'
  const svg = variants[type]

  if (!svg) {
    throw new Error(`Missing weui-miniprogram icon variant "${type}" for icon: ${icon.icon}`)
  }

  return svg
}

const tintSvg = (svg, color) =>
  svg.replace(/\b(fill|stroke)="([^"]+)"/gi, (match, attr, value) => {
    const normalizedValue = value.trim().toLowerCase()

    if (
      normalizedValue === 'none' ||
      normalizedValue === 'transparent' ||
      normalizedValue.startsWith('url(') ||
      !colorableValues.has(normalizedValue)
    ) {
      return match
    }

    return `${attr}="${color}"`
  })

const writeSvgAsset = icon => {
  const svg = tintSvg(loadSourceSvg(icon), '#000000')
  const outputPath = path.join(iconsDir, `${icon.name}.svg`)

  fs.writeFileSync(outputPath, `${svg.trim()}\n`, 'utf8')

  return svg.trim()
}

const writeTabbarAsset = icon => {
  const svg = tintSvg(loadSourceSvg(icon), icon.color)
  const svgPath = path.join(tabbarDir, `${icon.name}.generated.svg`)
  const pngPath = path.join(tabbarDir, `${icon.name}.png`)
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: icon.size
    }
  })

  fs.writeFileSync(svgPath, `${svg.trim()}\n`, 'utf8')
  fs.writeFileSync(pngPath, resvg.render().asPng())
}

const writeLegacyAntIconAliases = () => {
  fs.mkdirSync(legacyAntIconsDir, { recursive: true })
  fs.readdirSync(legacyAntIconsDir)
    .filter(fileName => fileName.endsWith('.svg'))
    .forEach(fileName => fs.rmSync(path.join(legacyAntIconsDir, fileName), { force: true }))

  Object.entries(legacyAntIconAliases).forEach(([legacyName, currentName]) => {
    const sourcePath = path.join(iconsDir, `${currentName}.svg`)
    const targetPath = path.join(legacyAntIconsDir, `${legacyName}.svg`)

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing generated icon for legacy alias: ${currentName}`)
    }

    fs.copyFileSync(sourcePath, targetPath)
  })
}

const main = () => {
  ensureUniqueNames(pageIcons)
  ensureUniqueNames(tabbarIcons)

  fs.mkdirSync(iconsDir, { recursive: true })
  fs.mkdirSync(tabbarDir, { recursive: true })
  fs.readdirSync(iconsDir)
    .filter(fileName => fileName.endsWith('.svg'))
    .forEach(fileName => fs.rmSync(path.join(iconsDir, fileName), { force: true }))

  for (const icon of pageIcons) {
    writeSvgAsset(icon)
  }

  for (const icon of tabbarIcons) {
    writeTabbarAsset(icon)
  }

  writeLegacyAntIconAliases()

  console.log(
    `Generated ${pageIcons.length} SVG icon assets in ${iconsDir}, ${Object.keys(legacyAntIconAliases).length} legacy icon aliases in ${legacyAntIconsDir}, and ${tabbarIcons.length} tabBar icon pairs in ${tabbarDir}`
  )
}

main()
