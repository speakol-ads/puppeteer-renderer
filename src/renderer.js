'use strict'

const puppeteer = require('puppeteer')

class Renderer {
  constructor(browser) {
    this.browser = browser
  }

  async createPage(url, options = {}) {
    const { timeout, waitUntil } = options
    const page = await this.browser.newPage()
    const authHeader = Buffer.from(
      `${process.env.PROXY_AUTH_USERNAME}:${process.env.PROXY_AUTH_PASSWORD}`,
    ).toString('base64')

    await page.authenticate({
      username: process.env.PROXY_AUTH_USERNAME,
      password: process.env.PROXY_AUTH_PASSWORD,
    })

    // await page.setRequestInterception(true)

    // page.on('request', function(req) {
    //   if ( ['stylesheet', 'font', 'image'].includes(req.resourceType()) ) {
    //     req.abort()
    //   }

    //   req.continue()
    // })

    await page.goto(url, {
      timeout: Number(timeout) || Number(process.env.DEFAULT_TIMEOUT),
      waitUntil: waitUntil || process.env.DEFAULT_WAIT_UNTIL,
    })

    return page
  }

  async render(url, options = {}) {
    let page = null
    try {
      const { timeout, waitUntil } = options
      const page = await this.createPage(url, { timeout, waitUntil })
      const html = await page.content()

      return html
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  async pdf(url, options = {}) {
    let page = null
    try {
      const { timeout, waitUntil, ...extraOptions } = options
      page = await this.createPage(url, { timeout, waitUntil })

      const { scale = 1.0, displayHeaderFooter, printBackground, landscape } = extraOptions
      const buffer = await page.pdf({
        ...extraOptions,
        scale: Number(scale),
        displayHeaderFooter: displayHeaderFooter === 'true',
        printBackground: printBackground === 'true',
        landscape: landscape === 'true',
      })
      return buffer
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  async screenshot(url, options = {}) {
    let page = null
    try {
      const { timeout, waitUntil, ...extraOptions } = options
      page = await this.createPage(url, { timeout, waitUntil })
      page.setViewport({
        width: Number(extraOptions.width || 800),
        height: Number(extraOptions.height || 600),
      })

      const { fullPage, omitBackground, imageType, quality } = extraOptions
      const buffer = await page.screenshot({
        ...extraOptions,
        type: imageType || 'png',
        quality: Number(quality) || (imageType === undefined || imageType == 'png' ? 0 : 100),
        fullPage: fullPage === 'true',
        omitBackground: omitBackground === 'true',
      })
      return buffer
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  async close() {
    await this.browser.close()
  }
}

async function create() {
  const browser = await puppeteer.launch({
    headless: false,
    ignoreHTTPSErrors: true,
    defaultViewport: {
      width: Number(1921),
      height: Number(1080),
    },
    args: ['--no-sandbox', `--proxy-server=${process.env.PROXY_URL}`],
  })
  return new Renderer(browser)
}

module.exports = create
