import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import App from "./App";
import PrivacyPolicy from "./pages/PrivacyPolicy";

/** Render a route to an HTML string for build-time prerendering. */
export function render(url: string) {
  return renderToString(
    <StrictMode>
      {/* The client lazy-loads the privacy page; prerender it eagerly. */}
      <App url={url} PrivacyPolicy={PrivacyPolicy} />
    </StrictMode>,
  );
}
