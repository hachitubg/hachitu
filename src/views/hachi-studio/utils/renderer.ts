import type { Look } from '../data/looks'
import type { MakeupEffect } from '../composables/useMakeup'
import { NEUTRAL_COLOR } from './color'
import type { ColorAdjustments } from './color'
import type { BackgroundEffect } from '../composables/useBackground'
import type { LutTexture } from './lut'

interface Renderer {
  gl: WebGLRenderingContext
  program: WebGLProgram
  texture: WebGLTexture
  maskTexture: WebGLTexture
  lastMask?: HTMLCanvasElement
  backgroundTexture: WebGLTexture
  lastBackground?: HTMLCanvasElement
  lutTexture: WebGLTexture
  lastLut?: HTMLImageElement
}
const renderers = new WeakMap<HTMLCanvasElement, Renderer>()
const vertex = `attribute vec2 position; varying vec2 uv;
void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}`
const fragment = `precision highp float;
varying vec2 uv; uniform sampler2D image;
uniform vec4 grade; uniform vec3 extra; uniform vec2 crop; uniform vec2 offset; uniform float mirror;
uniform sampler2D faceMask; uniform vec4 beauty; uniform vec4 cheeks;
uniform vec2 reshape; uniform vec2 pixel; uniform vec3 lipColor; uniform vec3 blushColor;
uniform vec4 adjustment; uniform vec4 finish; uniform vec2 texel;
uniform sampler2D backgroundMask; uniform vec3 backgroundMode; uniform vec3 backgroundColor;
uniform vec2 blurRadius;
uniform sampler2D colorLut;uniform vec3 lutInfo;
uniform vec2 tone;
vec3 lutPoint(vec3 point){
  float index=point.x+point.y*lutInfo.x+point.z*lutInfo.x*lutInfo.x;
  vec2 cell=vec2(mod(index,lutInfo.y),floor(index/lutInfo.y));
  return texture2D(colorLut,vec2((cell.x+0.5)/lutInfo.y,1.0-(cell.y+0.5)/lutInfo.z)).rgb;
}
vec3 applyLut(vec3 color){
  vec3 point=clamp(color,0.0,1.0)*(lutInfo.x-1.0),lo=floor(point),hi=min(lo+1.0,vec3(lutInfo.x-1.0)),f=fract(point);
  vec3 a=mix(lutPoint(vec3(lo.x,lo.y,lo.z)),lutPoint(vec3(hi.x,lo.y,lo.z)),f.x);
  vec3 b=mix(lutPoint(vec3(lo.x,hi.y,lo.z)),lutPoint(vec3(hi.x,hi.y,lo.z)),f.x);
  vec3 c=mix(lutPoint(vec3(lo.x,lo.y,hi.z)),lutPoint(vec3(hi.x,lo.y,hi.z)),f.x);
  vec3 d=mix(lutPoint(vec3(lo.x,hi.y,hi.z)),lutPoint(vec3(hi.x,hi.y,hi.z)),f.x);
  return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);
}
void main(){
  vec2 p=(uv-0.5)*crop+0.5+offset;
  p.x=mix(p.x,1.0-p.x,mirror);
  vec2 left=cheeks.xy; vec2 right=cheeks.zw;
  vec2 axis=(right-left)/max(length(right-left),0.001);
  float r=max(reshape.y,0.001);
  float a=exp(-dot(p-left,p-left)/(r*r));
  float b=exp(-dot(p-right,p-right)/(r*r));
  p+=axis*(b-a)*r*reshape.x*0.18;
  vec3 original=texture2D(image,p).rgb;
  vec3 mask=texture2D(faceMask,p).rgb;
  vec3 base=original;
  float foreground=texture2D(backgroundMask,p).r;
  if(backgroundMode.z>0.5 && blurRadius.x>0.0 && foreground<0.999){
    vec3 backgroundSum=vec3(0.0);float backgroundWeights=0.0;
    for(int i=0;i<24;i++){
      float angle=float(i)*2.399963;
      float distance=sqrt((float(i)+0.5)/24.0);
      vec2 samplePoint=clamp(p+vec2(cos(angle),sin(angle))*blurRadius*distance,0.0,1.0);
      float weight=(1.0-texture2D(backgroundMask,samplePoint).r)*exp(-distance*distance*1.5);
      backgroundSum+=texture2D(image,samplePoint).rgb*weight;backgroundWeights+=weight;
    }
    vec3 blurred=backgroundWeights>0.001?backgroundSum/backgroundWeights:original;
    base=mix(blurred,base,foreground);
  }
  if(beauty.x>0.0 && mask.r>0.0){
    vec3 sum=original; float weights=1.0;
    for(int i=0;i<8;i++){
      float angle=float(i)*0.785398;
      vec3 neighbor=texture2D(image,p+vec2(cos(angle),sin(angle))*pixel*2.5).rgb;
      vec3 diff=neighbor-original;
      float weight=exp(-dot(diff,diff)*35.0);
      sum+=neighbor*weight; weights+=weight;
    }
    base=mix(base,sum/weights,beauty.x*mask.r*0.75);
  }
  base+=vec3(beauty.y*mask.r*0.10);
  float luminosity=dot(base,vec3(0.2126,0.7152,0.0722));
  base=mix(base,lipColor*(0.45+luminosity*0.75),beauty.z*mask.g*0.70);
  base=mix(base,blushColor,beauty.w*mask.b*mask.r*0.28);
  vec3 c=base*exp2(grade.x);
  c=(c-0.5)*grade.y+0.5;
  float l=dot(c,vec3(0.2126,0.7152,0.0722));
  c=mix(vec3(l),c,grade.z);
  c+=vec3(grade.w*0.12+extra.x*0.04,-extra.x*0.07,-grade.w*0.12+extra.x*0.04);
  c=c*(1.0-extra.y)+extra.y*0.5;
  if(lutInfo.x>1.0)c=applyLut(base);
  vec3 graded=mix(base,clamp(c,0.0,1.0),extra.z);
  graded*=exp2(adjustment.x);
  graded=(graded-0.5)*(1.0+adjustment.y)+0.5;
  float gray=dot(graded,vec3(0.2126,0.7152,0.0722));
  graded=mix(vec3(gray),graded,1.0+adjustment.z);
  graded+=vec3(adjustment.w*0.12+finish.x*0.04,-finish.x*0.07,-adjustment.w*0.12+finish.x*0.04);
  graded=graded*(1.0-finish.y)+finish.y*0.5;
  float toneLight=dot(graded,vec3(0.2126,0.7152,0.0722));
  graded+=vec3(tone.x*0.25*(1.0-smoothstep(0.0,0.55,toneLight)));
  graded+=vec3(tone.y*0.20*smoothstep(0.45,1.0,toneLight));
  if(finish.z>0.0){
    vec3 blur=(texture2D(image,p+vec2(texel.x,0.0)).rgb+texture2D(image,p-vec2(texel.x,0.0)).rgb+texture2D(image,p+vec2(0.0,texel.y)).rgb+texture2D(image,p-vec2(0.0,texel.y)).rgb)*0.25;
    graded+=(original-blur)*finish.z*0.7*(backgroundMode.z>0.5?foreground:1.0);
  }
  graded*=1.0-smoothstep(0.22,0.72,length(uv-0.5))*finish.w*0.65;
  float alpha=(backgroundMode.x>0.5 && backgroundMode.z<0.5?foreground:1.0)*texture2D(image,p).a;
  vec3 outputColor=clamp(graded,0.0,1.0);
  if(backgroundMode.y>0.5 && backgroundMode.z<0.5){outputColor=mix(backgroundColor,outputColor,alpha);alpha=1.0;}
  gl_FragColor=vec4(outputColor,alpha);
}`

function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const gl = canvas.getContext('webgl', {
    preserveDrawingBuffer: true,
    alpha: true,
    premultipliedAlpha: false,
  })
  if (!gl)
    throw new Error('Trình duyệt chưa hỗ trợ xử lý màu. Hãy thử Safari hoặc Chrome mới nhất.')
  const program = gl.createProgram()
  const texture = gl.createTexture()
  if (!program || !texture) throw new Error('Không thể khởi tạo bộ xử lý ảnh.')
  for (const [type, code] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)
    if (!shader) throw new Error('Không thể khởi tạo bộ màu.')
    gl.shaderSource(shader, code)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error('Thiết bị chưa hỗ trợ bộ màu này.')
    gl.attachShader(program, shader)
    gl.deleteShader(shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error('Không thể tải bộ xử lý màu.')
  gl.useProgram(program)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const attribute = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(attribute)
  gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  const maskTexture = gl.createTexture()
  if (!maskTexture) throw new Error('Không tạo được bộ xử lý Makeup.')
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, maskTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGB,
    1,
    1,
    0,
    gl.RGB,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0]),
  )
  gl.uniform1i(gl.getUniformLocation(program, 'faceMask'), 1)
  gl.activeTexture(gl.TEXTURE0)
  const backgroundTexture = gl.createTexture()
  if (!backgroundTexture) throw new Error('Không tạo được bộ xóa phông.')
  gl.activeTexture(gl.TEXTURE2)
  gl.bindTexture(gl.TEXTURE_2D, backgroundTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGB,
    1,
    1,
    0,
    gl.RGB,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255]),
  )
  gl.uniform1i(gl.getUniformLocation(program, 'backgroundMask'), 2)
  gl.activeTexture(gl.TEXTURE0)
  const lutTexture = gl.createTexture()
  if (!lutTexture) throw new Error('Không khởi tạo được bảng màu.')
  gl.activeTexture(gl.TEXTURE3)
  gl.bindTexture(gl.TEXTURE_2D, lutTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGB,
    1,
    1,
    0,
    gl.RGB,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0]),
  )
  gl.uniform1i(gl.getUniformLocation(program, 'colorLut'), 3)
  gl.activeTexture(gl.TEXTURE0)
  const renderer = { gl, program, texture, maskTexture, backgroundTexture, lutTexture }
  renderers.set(canvas, renderer)
  return renderer
}

export function render(
  canvas: HTMLCanvasElement,
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  look: Look,
  strength: number,
  ratio: number,
  size = 720,
  mirror = false,
  framing = { zoom: 1, x: 0, y: 0 },
  makeup?: MakeupEffect,
  adjustments: ColorAdjustments = NEUTRAL_COLOR,
  background?: BackgroundEffect,
  lut?: LutTexture,
) {
  const width =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLImageElement
        ? source.naturalWidth
        : source.width
  const height =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLImageElement
        ? source.naturalHeight
        : source.height
  if (!width || !height) return
  const renderer = renderers.get(canvas) ?? createRenderer(canvas)
  const { gl, program } = renderer
  const w = Math.round(size * Math.min(1, ratio))
  const h = Math.round(size / Math.max(1, ratio))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  gl.viewport(0, 0, w, h)
  gl.useProgram(program)
  gl.uniform3f(
    gl.getUniformLocation(program, 'lutInfo'),
    lut?.grid ?? 0,
    lut?.image.naturalWidth ?? 1,
    lut?.image.naturalHeight ?? 1,
  )
  gl.uniform2f(
    gl.getUniformLocation(program, 'tone'),
    (adjustments.shadows ?? 0) / 100,
    (adjustments.highlights ?? 0) / 100,
  )
  if (lut && renderer.lastLut !== lut.image) {
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, renderer.lutTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, lut.image)
    renderer.lastLut = lut.image
  }
  gl.uniform3f(
    gl.getUniformLocation(program, 'backgroundMode'),
    background ? 1 : 0,
    background?.color ? 1 : 0,
    background?.blur !== undefined ? 1 : 0,
  )
  const blurAmount = (Math.max(0, Math.min(100, background?.blur ?? 0)) / 100) * 0.035
  gl.uniform2f(
    gl.getUniformLocation(program, 'blurRadius'),
    blurAmount,
    (blurAmount * width) / height,
  )
  const backgroundRGB = background?.color
    ? [1, 3, 5].map((i) => parseInt(background.color!.slice(i, i + 2), 16) / 255)
    : [1, 1, 1]
  gl.uniform3fv(gl.getUniformLocation(program, 'backgroundColor'), backgroundRGB)
  if (background && renderer.lastBackground !== background.mask) {
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, renderer.backgroundTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, background.mask)
    renderer.lastBackground = background.mask
  }
  gl.uniform4f(
    gl.getUniformLocation(program, 'adjustment'),
    adjustments.exposure,
    adjustments.contrast / 100,
    adjustments.saturation / 100,
    adjustments.warmth / 100,
  )
  gl.uniform4f(
    gl.getUniformLocation(program, 'finish'),
    adjustments.tint / 100,
    adjustments.fade / 100,
    adjustments.sharpness / 100,
    adjustments.vignette / 100,
  )
  gl.uniform2f(gl.getUniformLocation(program, 'texel'), 2 / width, 2 / height)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, renderer.texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  const settings = makeup?.settings
  const enabled = !!settings?.enabled && !!makeup
  gl.uniform4f(
    gl.getUniformLocation(program, 'beauty'),
    enabled ? settings.smooth / 100 : 0,
    enabled ? settings.brighten / 100 : 0,
    enabled ? settings.lipstick / 100 : 0,
    enabled ? settings.blush / 100 : 0,
  )
  gl.uniform2f(
    gl.getUniformLocation(program, 'reshape'),
    enabled ? settings.slim / 100 : 0,
    makeup?.face.radius ?? 0.1,
  )
  gl.uniform4fv(gl.getUniformLocation(program, 'cheeks'), makeup?.face.cheeks ?? [0, 0, 0, 0])
  // Radius is defined in source coordinates so the same skin treatment survives export scaling.
  const smoothingRadius = makeup ? Math.max(0.0008, makeup.face.radius * 0.025) : 0
  gl.uniform2f(
    gl.getUniformLocation(program, 'pixel'),
    smoothingRadius,
    (smoothingRadius * width) / height,
  )
  const rgb = (hex: string) =>
    [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  gl.uniform3fv(gl.getUniformLocation(program, 'lipColor'), rgb(settings?.lipColor ?? '#b6414a'))
  gl.uniform3fv(
    gl.getUniformLocation(program, 'blushColor'),
    rgb(settings?.blushColor ?? '#d87b78'),
  )
  if (enabled && renderer.lastMask !== makeup.face.mask) {
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, renderer.maskTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, makeup.face.mask)
    renderer.lastMask = makeup.face.mask
    gl.activeTexture(gl.TEXTURE0)
  }
  const sourceRatio = width / height
  const zoom = Math.max(1, framing.zoom)
  const cropX = Math.min(1, ratio / sourceRatio) / zoom
  const cropY = Math.min(1, sourceRatio / ratio) / zoom
  gl.uniform2f(gl.getUniformLocation(program, 'crop'), cropX, cropY)
  gl.uniform2f(
    gl.getUniformLocation(program, 'offset'),
    (Math.max(-1, Math.min(1, framing.x)) * (1 - cropX)) / 2,
    (-Math.max(-1, Math.min(1, framing.y)) * (1 - cropY)) / 2,
  )
  gl.uniform1f(gl.getUniformLocation(program, 'mirror'), mirror ? 1 : 0)
  gl.uniform4f(
    gl.getUniformLocation(program, 'grade'),
    look.exposure,
    look.contrast,
    look.saturation,
    look.warmth,
  )
  gl.uniform3f(
    gl.getUniformLocation(program, 'extra'),
    look.tint,
    look.fade,
    Math.max(0, Math.min(1, strength)),
  )
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

export function dispose(canvas: HTMLCanvasElement) {
  renderers.get(canvas)?.gl.getExtension('WEBGL_lose_context')?.loseContext()
  renderers.delete(canvas)
}

export function demoScene() {
  const canvas = document.createElement('canvas')
  canvas.width = 600
  canvas.height = 800
  const ctx = canvas.getContext('2d')!
  const sky = ctx.createLinearGradient(0, 0, 0, 800)
  sky.addColorStop(0, '#91b4c1')
  sky.addColorStop(0.55, '#efceac')
  sky.addColorStop(1, '#d88354')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 600, 800)
  ctx.fillStyle = '#ffe8b5'
  ctx.beginPath()
  ctx.arc(430, 200, 70, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#7c8c72'
  ctx.beginPath()
  ctx.moveTo(0, 500)
  ctx.lineTo(180, 300)
  ctx.lineTo(390, 560)
  ctx.lineTo(600, 360)
  ctx.lineTo(600, 800)
  ctx.lineTo(0, 800)
  ctx.fill()
  ctx.fillStyle = '#405e59'
  ctx.beginPath()
  ctx.moveTo(0, 670)
  ctx.lineTo(350, 490)
  ctx.lineTo(600, 620)
  ctx.lineTo(600, 800)
  ctx.lineTo(0, 800)
  ctx.fill()
  ctx.fillStyle = '#ead3ab'
  ctx.beginPath()
  ctx.moveTo(220, 800)
  ctx.lineTo(330, 600)
  ctx.lineTo(350, 600)
  ctx.lineTo(380, 800)
  ctx.fill()
  return canvas
}
