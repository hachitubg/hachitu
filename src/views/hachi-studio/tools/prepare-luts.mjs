import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const revision = '3b3180f82d4dcea1e6e8c5648473539a910d7f49'
const root = `https://raw.githubusercontent.com/cedeber/hald-clut/${revision}/HaldCLUT/Film Simulation/`
const destination = fileURLToPath(new URL('../../../../public/hachi-studio/luts/', import.meta.url))
const selections = [
  ['portra-160', 'Color/Kodak/Kodak Portra 160 2.png'],
  ['portra-400', 'Color/Kodak/Kodak Portra 400 2.png'],
  ['ektar-100', 'Color/Kodak/Kodak Ektar 100.png'],
  ['kodachrome-64', 'Color/Kodak/Kodak Kodachrome 64.png'],
  ['agfa-vista', 'Color/Agfa/Agfa Vista 200.png'],
  ['fuji-400h', 'Color/Fuji/Fuji 400H 2.png'],
  ['teal-orange', 'Color/CreativePack-1/TealOrange.png'],
  ['bleach-bypass', 'Color/CreativePack-1/BleachBypass1.png'],
  ['crisp-winter', 'Color/CreativePack-1/CrispWinter.png'],
  ['late-sunset', 'Color/CreativePack-1/LateSunset.png'],
  ['tmax-100', 'Black and White/Kodak/Kodak T-Max 100.png'],
  ['tri-x-400', 'Black and White/Kodak/Kodak TRI-X 400 2.png'],
]
await mkdir(destination, { recursive: true })
async function download(path) {
  const response = await fetch(root + path.split('/').map(encodeURIComponent).join('/'))
  if (!response.ok) throw new Error(`${response.status}: ${path}`)
  return Buffer.from(await response.arrayBuffer())
}
await writeFile(destination + '/SOURCE-LICENSE.txt', await download('README.txt'))
for (const [id, source] of selections) {
  const { data, info } = await sharp(await download(source))
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const n = Math.round(Math.cbrt(info.width * info.height))
  if (n ** 3 !== info.width * info.height || info.channels !== 3)
    throw new Error(`Invalid Hald LUT: ${source}`)
  const grid = 32
  const out = Buffer.alloc(grid ** 3 * 3)
  // Resample the 3D table, never resize the flattened PNG as a regular photograph.
  for (let b = 0; b < grid; b++)
    for (let g = 0; g < grid; g++)
      for (let r = 0; r < grid; r++) {
        const coord = [r, g, b].map((v) => (v * (n - 1)) / (grid - 1))
        const lo = coord.map(Math.floor),
          hi = lo.map((v) => Math.min(n - 1, v + 1)),
          fraction = coord.map((v, i) => v - lo[i])
        for (let channel = 0; channel < 3; channel++) {
          let value = 0
          for (let z = 0; z < 2; z++)
            for (let y = 0; y < 2; y++)
              for (let x = 0; x < 2; x++) {
                const i =
                  (x ? hi[0] : lo[0]) + (y ? hi[1] : lo[1]) * n + (z ? hi[2] : lo[2]) * n * n
                value +=
                  data[i * 3 + channel] *
                  (x ? fraction[0] : 1 - fraction[0]) *
                  (y ? fraction[1] : 1 - fraction[1]) *
                  (z ? fraction[2] : 1 - fraction[2])
              }
          out[(r + g * grid + b * grid * grid) * 3 + channel] = Math.round(value)
        }
      }
  const file = await sharp(out, { raw: { width: 256, height: 128, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await writeFile(`${destination}/${id}.png`, file)
  console.log(`${id}: ${file.length} bytes, source grid ${n}, output grid 32`)
}
