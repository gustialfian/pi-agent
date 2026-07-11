---
name: explain-code
description: Explain code provided with rich interactive html
disable-model-invocation: true
---

Please make me a rich, interactive explanation of the specified code.

It should have these sections:

- Background: Explain the existing system surrounding this code. Broadly explore the relevant modules, architecture, and dependencies so the reader understands where this code fits. Assume the reader may be completely new to the codebase: first provide a beginner-friendly overview of the larger system, then progressively narrow the explanation to the specific files, classes, or functions being examined.
- Intuition: Explain the core idea behind this code. Focus on *why* it exists, what problem it solves, and the mental model needed to understand it. Avoid implementation details initially. Use concrete examples with toy data, analogies, state diagrams, sequence diagrams, and other figures wherever they make the concepts easier to grasp.
- Code: Walk through the implementation at a high level. Organize the explanation by concepts rather than file order. Explain the responsibilities of each component, how data flows through the system, how functions and classes interact, important control flow, invariants, assumptions, and noteworthy implementation decisions. Highlight tradeoffs and explain why the code is structured this way instead of plausible alternatives. Avoid line-by-line commentary unless a section is particularly subtle.
- Execution: Follow one or more realistic examples from input to output. Trace how data moves through the code, showing how state changes, which functions are called, and how intermediate values evolve. Include diagrams or tables where they improve understanding.
- Quiz: Create five medium-difficulty multiple-choice questions that test genuine understanding of the code. The questions should require reasoning about the architecture, data flow, execution, or design decisions rather than memorizing implementation details. Present them as interactive multiple-choice questions that immediately indicate whether the selected answer is correct and explain why.

Format:

- Output a single self-contained HTML file which includes CSS and JavaScript. Make the whole thing one long page with section headers and a table of contents. Don't use tabs for the top-level structure. Basic responsive styling so you can view it on a phone is nice too. Put the file in a global place on my computer outside of the code repo, and make sure the filename always starts with today's date in `YYYY-MM-DD-` format, because it helps keep the files time-sorted and out of version control. For example: /tmp/2026-01-12-explanation-<slug>.html
- Please write with the clarity and flow of Martin Kleppmann, making it engaging and written in classic style. Transitions between sections should be smooth.
- Some tips on diagrams. Ideally, you should pick a small number of diagram families that can be reused throughout the explanation to explain various cases. Some useful kinds of diagrams:
  - A very simplified version of the UI that the user sees in the app, to explain UI changes.
  - A system diagram showing data flow or communication between components. Make sure to include example data here!
- Don't use ASCII diagrams. Always use simple HTML designs for your diagrams, HTML lists for lists of things, etc.
  - For code blocks, always use `<pre>` tags. If you use a custom styled div instead, it **must** have
    `white-space: pre-wrap` in its CSS, or the browser will collapse all newlines into a single line.
    Before saving the file, scan each code block in the HTML source and confirm its CSS includes
    `white-space: pre` or `pre-wrap`.
- Use callouts for key concepts or definitions, important edge cases, etc.
- Use "Catppuccin Macchiato" as color scheme
