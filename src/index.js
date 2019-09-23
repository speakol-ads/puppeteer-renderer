'use strict'

require('dotenv').config()

const express = require('express')
const { URL } = require('url')
const contentDisposition = require('content-disposition')
const createRenderer = require('./renderer')
const port = process.env.LISTEN_PORT || 3000
const app = express()
const maxRequests = Number(process.env.MAX_REQUESTS)

let renderer = null
let requests = 0
let restarts = 0

// Configure.
app.disable('x-powered-by')

// Render url.
app.use(async (req, res, next) => {
  console.log(`> serving ${req.url} ...`)
  if (maxRequests > 0 && requests >= maxRequests) {
    console.log('restarting ...')
    renderer = await renderer.restart()
    requests = 0
    restarts++
    console.log(`restarted(${restarts}) ...`)
  }

  requests++

  let { url, type, ...options } = req.query

  if (!url) {
    return res.status(400).send('Search with url parameter. For eaxample, ?url=http://yourdomain')
  }

  if (!url.includes('://')) {
    url = `http://${url}`
  }

  try {
    switch (type) {
      case 'pdf':
        const urlObj = new URL(url)
        let filename = urlObj.hostname
        if (urlObj.pathname !== '/') {
          filename = urlObj.pathname.split('/').pop()
          if (filename === '') filename = urlObj.pathname.replace(/\//g, '')
          const extDotPosition = filename.lastIndexOf('.')
          if (extDotPosition > 0) filename = filename.substring(0, extDotPosition)
        }
        const pdf = await renderer.pdf(url, options)
        res
          .set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdf.length,
            'Content-Disposition': contentDisposition(filename + '.pdf'),
          })
          .send(pdf)
        break

      case 'screenshot':
        const image = await renderer.screenshot(url, options)
        res
          .set({
            'Content-Type': 'image/png',
            'Content-Length': image.length,
          })
          .send(image)
        break

      default:
        const html = await renderer.render(url, options)
        res.status(200).send(html)
    }
  } catch (e) {
    next(e)
  }
})

// Error page.
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).send('Oops, An expected error seems to have occurred.<br />' + err.message)
})

// Create renderer and start server.
createRenderer()
  .then(createdRenderer => {
    renderer = createdRenderer
    console.info('Initialized renderer.')

    app.listen(port, () => {
      console.info(`Listen port on ${port}.`)
    })
  })
  .catch(e => {
    console.error('Fail to initialze renderer.', e)
  })

// Terminate process
process.on('SIGINT', () => {
  process.exit(0)
})
