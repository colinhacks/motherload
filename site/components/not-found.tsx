import type { CSSProperties } from 'react';

// Next.js's page for a missing address, which the site showed until it left Next.js: "404" and
// "This page could not be found.", centred, in the system's font, black on white or white on black
// by the browser's theme.
const page: CSSProperties = { fontFamily: 'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"', height: '100vh', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const code: CSSProperties = { display: 'inline-block', margin: '0 20px 0 0', padding: '0 23px 0 0', fontSize: 24, fontWeight: 500, verticalAlign: 'top', lineHeight: '49px' };
const message: CSSProperties = { fontSize: 14, fontWeight: 400, lineHeight: '49px', margin: 0 };
const theme = 'body{color:#000;background:#fff;margin:0}.dk-error-code{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.dk-error-code{border-right:1px solid rgba(255,255,255,.3)}}';

export function NotFound({ status = 404, text = 'This page could not be found.' }: { status?: number; text?: string }) {
  return (
    <div style={page}>
      <div>
        <style dangerouslySetInnerHTML={{ __html: theme }} />
        <h1 className="dk-error-code" style={code}>
          {status}
        </h1>
        <div style={{ display: 'inline-block' }}>
          <h2 style={message}>{text}</h2>
        </div>
      </div>
    </div>
  );
}
