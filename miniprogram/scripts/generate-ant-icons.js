const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const iconVariants = [
  ['arrow-left-dark.svg', 'ArrowLeftOutlined', '#1f2329'],
  ['arrow-right-blue.svg', 'ArrowRightOutlined', '#1677ff'],
  ['arrow-right-muted.svg', 'ArrowRightOutlined', '#b6bdc8'],
  ['arrow-right-light.svg', 'ArrowRightOutlined', '#c0c7d2'],
  ['check-success.svg', 'CheckOutlined', '#1f9d63'],
  ['check-white.svg', 'CheckOutlined', '#ffffff'],
  ['close-fail.svg', 'CloseOutlined', '#ff4d4f'],
  ['close-muted.svg', 'CloseOutlined', '#98a2b3'],
  ['customer-service-blue.svg', 'CustomerServiceOutlined', '#1677ff'],
  ['environment-blue.svg', 'EnvironmentOutlined', '#2d7fff'],
  ['environment-green.svg', 'EnvironmentOutlined', '#10b981'],
  ['environment-orange.svg', 'EnvironmentOutlined', '#ff7a45'],
  ['environment-violet.svg', 'EnvironmentOutlined', '#8b5cf6'],
  ['environment-white.svg', 'EnvironmentOutlined', '#ffffff'],
  ['loading-blue.svg', 'LoadingOutlined', '#2d7fff'],
  ['search-muted.svg', 'SearchOutlined', '#98a2b3'],
  ['thunderbolt-blue.svg', 'ThunderboltOutlined', '#3b82f6'],
  ['user-white.svg', 'UserOutlined', '#ffffff']
]

const outputDir = path.join(__dirname, '..', 'assets', 'ant-icons')
const tabbarDir = path.join(__dirname, '..', 'assets', 'tabbar')

const escapeAttribute = value =>
  `${value}`
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')

const applyColor = (attrs, color) => {
  const nextAttrs = { ...attrs }

  if (nextAttrs.fill == null && nextAttrs.stroke == null) {
    nextAttrs.fill = color
  }

  if (nextAttrs.fill === 'currentColor') {
    nextAttrs.fill = color
  }

  if (nextAttrs.stroke === 'currentColor') {
    nextAttrs.stroke = color
  }

  return nextAttrs
}

const renderNode = (node, color) => {
  const attrs = applyColor(node.attrs || {}, color)
  const attrText = Object.entries(attrs)
    .map(([key, value]) => `${key}="${escapeAttribute(value)}"`)
    .join(' ')
  const openTag = attrText ? `<${node.tag} ${attrText}>` : `<${node.tag}>`
  const children = (node.children || []).map(child => renderNode(child, color)).join('')
  return `${openTag}${children}</${node.tag}>`
}

const renderIcon = (iconName, color) => {
  const icon = require(`@ant-design/icons-svg/lib/asn/${iconName}`).default
  const svgNode = icon.icon
  const attrs = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: '1024',
    height: '1024',
    ...svgNode.attrs
  }

  return `${renderNode({ ...svgNode, attrs }, color)}\n`
}

fs.mkdirSync(outputDir, { recursive: true })

for (const [fileName, iconName, color] of iconVariants) {
  fs.writeFileSync(path.join(outputDir, fileName), renderIcon(iconName, color), 'utf8')
}

const tabbarVariants = [
  ['home.png', 'HomeOutlined', '#8f96a3'],
  ['home-active.png', 'HomeOutlined', '#1677ff'],
  ['mine.png', 'UserOutlined', '#8f96a3'],
  ['mine-active.png', 'UserOutlined', '#1677ff']
]

fs.mkdirSync(tabbarDir, { recursive: true })

for (const [fileName, iconName, color] of tabbarVariants) {
  const tempSvgPath = path.join(tabbarDir, `${path.parse(fileName).name}.generated.svg`)
  const outputPath = path.join(tabbarDir, fileName)
  const thumbnailPath = path.join(tabbarDir, `${path.basename(tempSvgPath)}.png`)

  fs.writeFileSync(tempSvgPath, renderIcon(iconName, color), 'utf8')
  execFileSync('qlmanage', ['-t', '-s', '81', '-o', tabbarDir, tempSvgPath], {
    stdio: 'ignore'
  })
  fs.renameSync(thumbnailPath, outputPath)
  fs.unlinkSync(tempSvgPath)
}

console.log(
  `Generated ${iconVariants.length} Ant Design SVG assets in ${outputDir} and ${tabbarVariants.length} tabBar PNG assets in ${tabbarDir}`
)
