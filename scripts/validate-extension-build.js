#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * 验证Chrome扩展构建是否正确
 */
function validateExtensionBuild() {
  console.log('🔍 验证Chrome扩展构建...')
  
  const distDir = 'dist'
  
  if (!existsSync(distDir)) {
    console.error('❌ dist目录不存在，请先运行扩展构建命令')
    process.exit(1)
  }
  
  // 检查必要的扩展文件是否存在
  const requiredFiles = [
    'manifest.json',
    'popup.html',
    'service-worker.js',
    'content-script.js'
  ]
  
  const missingFiles = requiredFiles.filter(file => !existsSync(join(distDir, file)))
  
  if (missingFiles.length > 0) {
    console.error('❌ 缺少必要的扩展文件:')
    missingFiles.forEach(file => console.error(`   - ${file}`))
    process.exit(1)
  }
  
  // 检查dist目录中是否包含test相关文件
  const distFiles = getAllFiles(distDir)
  const testFiles = distFiles.filter(file => 
    file.includes('/test/') || 
    file.includes('\\test\\') ||
    file.includes('src/test')
  )
  
  if (testFiles.length > 0) {
    console.error('❌ 发现测试文件未被排除:')
    testFiles.forEach(file => console.error(`   - ${file}`))
    process.exit(1)
  }
  
  // 检查popup.html是否包含正确的资源引用
  const popupHtmlPath = join(distDir, 'popup.html')
  if (existsSync(popupHtmlPath)) {
    const popupContent = readFileSync(popupHtmlPath, 'utf8')
    if (popupContent.includes('src/test') || popupContent.includes('/test/')) {
      console.error('❌ popup.html包含测试目录引用')
      process.exit(1)
    }
  }
  
  // 检查是否有任何JS文件包含test目录的引用
  const jsFiles = distFiles.filter(file => file.endsWith('.js'))
  for (const jsFile of jsFiles) {
    try {
      const content = readFileSync(jsFile, 'utf8')
      if (content.includes('src/test') || content.includes('/test/main.js')) {
        console.error(`❌ ${jsFile} 包含测试目录引用`)
        process.exit(1)
      }
    } catch (error) {
      // 忽略读取错误
    }
  }
  
  console.log('✅ Chrome扩展构建验证通过:')
  console.log('   - 所有必要文件都存在')
  console.log('   - 测试目录已正确排除')
  console.log(`   - 构建输出包含 ${distFiles.length} 个文件`)
  
  // 显示构建文件大小统计
  const totalSize = distFiles.reduce((sum, file) => {
    try {
      return sum + statSync(file).size
    } catch {
      return sum
    }
  }, 0)
  
  console.log(`   - 总大小: ${(totalSize / 1024).toFixed(2)} KB`)
}

/**
 * 递归获取目录中的所有文件
 */
function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir)
  
  files.forEach(file => {
    const filePath = join(dir, file)
    if (statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList)
    } else {
      fileList.push(filePath)
    }
  })
  
  return fileList
}

// 运行验证
validateExtensionBuild()