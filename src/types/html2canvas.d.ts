// Type declaration for html2canvas (loaded lazily in FeedbackWidget).
// The package ships its own types but the dynamic import may not resolve
// without this shim during `tsc --noEmit`.
declare module 'html2canvas' {
  interface Html2CanvasOptions {
    useCORS?:       boolean;
    logging?:       boolean;
    ignoreElements?: (element: Element) => boolean;
    [key: string]:  unknown;
  }
  function html2canvas(element: HTMLElement, options?: Html2CanvasOptions): Promise<HTMLCanvasElement>;
  export default html2canvas;
}
