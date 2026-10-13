import { inpaint } from './inpaint'
self.onmessage = (
  event: MessageEvent<{
    image: Uint8ClampedArray
    mask: Uint8ClampedArray
    width: number
    height: number
  }>,
) => {
  try {
    const { image, mask, width, height } = event.data
    const result = inpaint(image, mask, width, height)
    self.postMessage({ result }, { transfer: [result.buffer] })
  } catch (reason) {
    self.postMessage({
      error: reason instanceof Error ? reason.message : 'Không xóa được vùng đã chọn.',
    })
  }
}
