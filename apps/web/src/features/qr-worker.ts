// Runs in a Web Worker: searching a camera picture for a QR code can take hundreds of milliseconds
// on a busy scene, and doing that on the page's own thread would freeze the till while it happens.
import jsQR from "jsqr";

type Request = { data: Uint8ClampedArray; width: number; height: number };
export type QrWorkerReply = { text: string | null };

self.onmessage = (event: MessageEvent<Request>) => {
  const { data, width, height } = event.data;
  const found = jsQR(data, width, height, { inversionAttempts: "dontInvert" });
  (self as unknown as Worker).postMessage({ text: found?.data ? found.data : null } satisfies QrWorkerReply);
};
