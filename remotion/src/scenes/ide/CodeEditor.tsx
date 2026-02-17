import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const { fontFamily } = loadInter("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

const { fontFamily: monoFont } = loadMono("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

type CodeEditorProps = {
  width: number;
  startFrame?: number;
};

type CodeLine = {
  lineNumber: number;
  content: React.ReactNode;
  typedText?: string;
  typeStartFrame?: number;
};

const colors = {
  keyword: "#ff7b72",
  string: "#a5d6ff",
  tag: "#7ee787",
  attribute: "#d2a8ff",
  comment: "#8b949e",
  default: "#e6edf3",
  lineNumber: "#484f58",
};

const CodeSpan: React.FC<{ color: string; children: React.ReactNode }> = ({
  color,
  children,
}) => <span style={{ color }}>{children}</span>;

const codeLines: CodeLine[] = [
  { lineNumber: 1, content: <CodeSpan color={colors.comment}>---</CodeSpan> },
  {
    lineNumber: 2,
    content: (
      <>
        <CodeSpan color={colors.keyword}>import</CodeSpan>{" "}
        <CodeSpan color={colors.string}>"@/styles/globals.css"</CodeSpan>;
      </>
    ),
  },
  { lineNumber: 3, content: "" },
  {
    lineNumber: 4,
    content: (
      <>
        <CodeSpan color={colors.keyword}>interface</CodeSpan>{" "}
        <CodeSpan color={colors.default}>Props</CodeSpan>{" "}
        <CodeSpan color={colors.default}>{"{"}</CodeSpan>
      </>
    ),
  },
  {
    lineNumber: 5,
    content: (
      <>
        {"  "}<CodeSpan color={colors.default}>title</CodeSpan>
        <CodeSpan color={colors.comment}>: string</CodeSpan>;
      </>
    ),
  },
  {
    lineNumber: 6,
    content: <CodeSpan color={colors.default}>{"}"}</CodeSpan>,
  },
  { lineNumber: 7, content: "" },
  {
    lineNumber: 8,
    content: (
      <>
        <CodeSpan color={colors.keyword}>const</CodeSpan>{" "}
        <CodeSpan color={colors.default}>{"{"} title {"}"}</CodeSpan>{" "}
        <CodeSpan color={colors.default}>=</CodeSpan>{" "}
        <CodeSpan color={colors.default}>Astro.props</CodeSpan>;
      </>
    ),
  },
  {
    lineNumber: 9,
    content: <CodeSpan color={colors.comment}>---</CodeSpan>,
  },
  { lineNumber: 10, content: "" },
  {
    lineNumber: 11,
    content: (
      <>
        <CodeSpan color={colors.tag}>&lt;!doctype html&gt;</CodeSpan>
      </>
    ),
  },
  {
    lineNumber: 12,
    content: (
      <>
        <CodeSpan color={colors.tag}>&lt;html</CodeSpan>{" "}
        <CodeSpan color={colors.attribute}>lang</CodeSpan>=
        <CodeSpan color={colors.string}>"en"</CodeSpan>{" "}
        <CodeSpan color={colors.tag}>&gt;</CodeSpan>
      </>
    ),
  },
  {
    lineNumber: 13,
    content: (
      <>
        {"  "}<CodeSpan color={colors.tag}>&lt;head&gt;</CodeSpan>
      </>
    ),
  },
  {
    lineNumber: 14,
    content: (
      <>
        {"    "}<CodeSpan color={colors.tag}>&lt;meta</CodeSpan>{" "}
        <CodeSpan color={colors.attribute}>charset</CodeSpan>=
        <CodeSpan color={colors.string}>"UTF-8"</CodeSpan>{" "}
        <CodeSpan color={colors.tag}>/&gt;</CodeSpan>
      </>
    ),
  },
  {
    lineNumber: 15,
    content: (
      <>
        {"    "}<CodeSpan color={colors.tag}>&lt;title&gt;</CodeSpan>
        <CodeSpan color={colors.default}>{"{"}title{"}"}</CodeSpan>
        <CodeSpan color={colors.tag}>&lt;/title&gt;</CodeSpan>
      </>
    ),
  },
  {
    lineNumber: 16,
    content: (
      <>
        {"  "}<CodeSpan color={colors.tag}>&lt;/head&gt;</CodeSpan>
      </>
    ),
  },
  {
    lineNumber: 17,
    content: (
      <>
        {"  "}<CodeSpan color={colors.tag}>&lt;body</CodeSpan>{" "}
        <CodeSpan color={colors.attribute}>class</CodeSpan>=
        <CodeSpan color={colors.string}>"min-h-screen bg-background"</CodeSpan>{" "}
        <CodeSpan color={colors.tag}>&gt;</CodeSpan>
      </>
    ),
  },
  {
    lineNumber: 18,
    content: (
      <>
        {"    "}<CodeSpan color={colors.tag}>&lt;slot /&gt;</CodeSpan>
      </>
    ),
  },
  {
    lineNumber: 19,
    content: null,
    typedText: "    <script src=\"/auth/google.ts\" />",
    typeStartFrame: 30,
  },
  {
    lineNumber: 20,
    content: null,
    typedText: "    <ExpenseTracker client:load />",
    typeStartFrame: 48,
  },
  {
    lineNumber: 21,
    content: (
      <>
        {"  "}<CodeSpan color={colors.tag}>&lt;/body&gt;</CodeSpan>
      </>
    ),
  },
  {
    lineNumber: 22,
    content: (
      <>
        <CodeSpan color={colors.tag}>&lt;/html&gt;</CodeSpan>
      </>
    ),
  },
];

export const CodeEditor: React.FC<CodeEditorProps> = ({ width, startFrame = 0 }) => {
  const globalFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = Math.max(0, globalFrame - startFrame);

  const lastTypingLine = codeLines.filter((l) => l.typedText).pop();
  const isTyping = lastTypingLine?.typeStartFrame
    ? frame >= lastTypingLine.typeStartFrame &&
      frame < lastTypingLine.typeStartFrame + (lastTypingLine.typedText?.length ?? 0) * 2
    : false;

  const cursorBlink = Math.floor(frame / 4) % 2 === 0 ? 1 : 0;

  const activeTypingLine = [...codeLines]
    .reverse()
    .find(
      (l) =>
        l.typedText &&
        l.typeStartFrame !== undefined &&
        frame >= l.typeStartFrame
    );

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width,
        backgroundColor: "#0d1117",
        fontFamily,
      }}
    >
      <div
        className="flex items-center px-4 py-2 border-b gap-2"
        style={{ borderColor: "#21262d" }}
      >
        <div
          className="px-3 py-1 text-sm rounded-t"
          style={{ backgroundColor: "#161b22", color: "#e6edf3" }}
        >
          layouts/Layout.astro
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <div style={{ fontFamily: monoFont, fontSize: 14, lineHeight: "1.6" }}>
          {codeLines.map((line, index) => {
            const isTypedLine = !!line.typedText;
            const typeStart = line.typeStartFrame ?? 0;

            if (isTypedLine && frame < typeStart) {
              return null;
            }

            const batchIndex = Math.floor(index / 5);
            const lineProgress = isTypedLine
              ? 1
              : spring({
                  frame: frame - 5 - batchIndex * 5,
                  fps,
                  config: { damping: 200 },
                });

            const lineX = isTypedLine ? 0 : interpolate(lineProgress, [0, 1], [30, 0]);
            const lineOpacity = lineProgress;

            const charsVisible = isTypedLine
              ? Math.floor((frame - typeStart) / 2)
              : -1;
            const visibleText = isTypedLine
              ? (line.typedText ?? "").slice(0, charsVisible)
              : "";
            const isThisLineActive = activeTypingLine === line;
            const showCursor = isThisLineActive || (!isTyping && line === lastTypingLine && frame >= typeStart);

            return (
              <div
                key={line.lineNumber}
                className="flex"
                style={{
                  transform: `translateX(${lineX}px)`,
                  opacity: lineOpacity,
                }}
              >
                <div
                  className="text-right pr-4 select-none"
                  style={{
                    color: colors.lineNumber,
                    minWidth: "2ch",
                  }}
                >
                  {line.lineNumber}
                </div>
                <div className="relative flex-1" style={{ color: colors.default }}>
                  {isTypedLine ? (
                    <span>
                      <CodeSpan color={colors.tag}>
                        {visibleText}
                      </CodeSpan>
                      {showCursor && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 2,
                            height: "1.1em",
                            backgroundColor: "#58a6ff",
                            opacity: cursorBlink,
                            verticalAlign: "text-bottom",
                            marginLeft: 1,
                          }}
                        />
                      )}
                    </span>
                  ) : (
                    line.content || <span>&nbsp;</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
