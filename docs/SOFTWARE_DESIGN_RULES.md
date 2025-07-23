# Rules for AI Code Generation: Prioritizing Simplicity and Reducing Complexity

This document outlines key principles from "A Philosophy of Software Design, 2nd Edition" to guide the generation of software code, with the primary goal of **minimizing system complexity**. Adhering to these rules will help ensure the generated code is easier to understand, modify, and maintain over its lifetime.

Complexity is defined as anything related to the structure of a software system that makes it hard to understand and modify [1]. It manifests as change amplification, high cognitive load, and unknown unknowns [2-4]. The root causes of complexity are **dependencies** and **obscurity** [4, 5].

## Core Design Principles

1.  **Prioritize Design Over Speed**: Do not introduce unnecessary complexities to finish a task faster [6, 7]. Focus on the long-term structure of the system and facilitate future extensions [7]. This is strategic programming, as opposed to tactical programming which focuses solely on getting code working quickly [6, 8].
2.  **Minimize and Encapsulate Complexity**: Strive to make code simpler and more obvious to eliminate complexity [9]. Encapsulate complexity using **modular design** so that developers only need to understand a small fraction of the system at once [9, 10]. The complexity of a system is heavily influenced by the parts developers spend the most time on [11].
3.  **Build Deep Modules**: Design modules (such as classes or functions) to have **simple interfaces** relative to the **powerful functionality** they provide [12]. These are called deep modules [12]. A simple interface minimizes the complexity imposed on the rest of the system and allows for internal modifications without affecting other modules [13]. Avoid **shallow modules**, which have complex interfaces but little functionality, or **classitis**, which results from too many small, shallow classes [12, 14, 15]. The most important goal is a simple interface, even if the implementation is complex [16, 17].
4.  **Practice Information Hiding**: Design modules to **hide information** about their implementation details from other modules [18, 19]. This is crucial for creating deep modules [19]. Avoid **information leakage**, where a design decision requires knowledge across multiple modules [4, 15]. Avoid **temporal decomposition**, structuring code based on execution order, as it often leads to information leakage and shallow modules [6, 15, 19]. Instead, encapsulate pieces of knowledge [19].
5.  **Favor General-Purpose Modules**: Code that is more general-purpose is simpler, cleaner, and easier to understand than specialized code [20]. General-purpose APIs lead to better information hiding and deeper modules [21]. Strive for the simplest interface that covers current needs, potentially replacing multiple special-purpose methods with one general-purpose one [22].
6.  **Push Specialization Upwards or Downwards**: While some specialization is inevitable, cleanly separate specialized code from general-purpose code [17, 23, 24]. Specialized code should reside in different modules than the general-purpose mechanisms it uses [24]. Avoid **special-general mixture** [15, 25].
7.  **Different Layers, Different Abstractions**: Ensure that modules at different levels of abstraction do not simply replicate the interface of modules at lower levels [17, 26]. Avoid **pass-through methods** that merely forward calls without adding value or simplifying the interface [15, 27].
8.  **Pull Complexity Downwards**: As a module developer, take on complexity within the module to make life easier for users of the module [16, 17, 28]. Handle complexity internally rather than exposing it through complex interfaces, exceptions, or excessive configuration parameters [28-31].
9.  **Define Errors Out Of Existence**: Exception handling significantly adds to complexity by creating special cases [32]. Whenever possible, redefine semantics so that error conditions are handled by the normal control flow [17, 32, 33]. For unavoidable exceptions, aim to mask them at a low level or aggregate them into a single handler [33].
10. **Design It Twice**: Consider multiple design alternatives for major decisions before committing to one. This leads to better designs and improves design skills [17, 34, 35].
11. **Decide What Matters**: Identify the most important aspects of the system and structure the design around them, emphasizing them through prominence, repetition, or centrality [15, 36, 37]. Hide or de-emphasize things that don't matter as much [15, 36, 38]. Minimize the number of things that *do* matter [39].

## Rules for Code Structure and Style

12. **Write Comments for Non-Obvious Information**: Comments are essential for providing information that cannot be easily deduced from the code itself [15, 40, 41]. They play a fundamental role in defining abstractions and hiding complexity [35, 42-44].
    *   **Avoid Repeating the Code**: Do not write comments that merely restate what is already obvious from the code [15, 45, 46].
    *   **Add Precision and Intuition**: Use lower-level comments to clarify exact meanings or constraints [47]. Use higher-level comments to provide intuition, overall intent, and abstract views [48-51].
    *   **Separate Interface and Implementation Comments**: Interface comments (e.g., for classes or methods) should describe what is needed to *use* the entity, defining its abstraction [52, 53]. Implementation comments should describe *how* the code works internally or *why* it was written a certain way [54, 55]. Do not let implementation details contaminate interface documentation [15, 56, 57].
    *   **Keep Comments Near the Code**: Place comments as close as possible to the code they describe [58]. Avoid putting crucial design information solely in commit messages [59, 60].
    *   **Avoid Duplication in Comments**: Document each design decision or piece of information exactly once. If needed, reference a central location for details [61, 62]. Do not repeat documentation for a called module in the caller's comments [63]. Reference external documentation where appropriate [64, 65].
13. **Choose Precise and Consistent Names**: Use names for variables, methods, and other entities that are precise, consistent, and create a clear image of the underlying object [66-69]. Consistent naming reduces cognitive load [67]. A vague or hard-to-pick name can be a **red flag** indicating a potential design problem [15, 59, 67].
14. **Strive for Obvious Code**: Code should be written so that readers can quickly understand its behavior and meaning without significant effort [70]. Good names and consistency contribute significantly to obviousness [68, 69]. Design code for **ease of reading**, even if it means slightly more effort during writing (e.g., defining specific structures instead of using generic containers) [15, 71].
15. **Split Methods Based on Abstraction, Not Just Length**: Methods should do one thing and do it completely, providing clean abstractions [72]. Split a method only if it allows factoring out a cleanly separable subtask into a child method, resulting in clearer abstractions overall [72, 73]. Avoid **conjoined methods** that cannot be understood independently [15, 25, 73]. Depth is more important than length [73].
16. **Eliminate Special Cases in Code Bodies**: Design the normal case to automatically handle edge conditions where possible, reducing the need for numerous `if` statements and simplifying code [27, 74].
17. **Maintain Consistency**: Ensure similar things are done in similar ways throughout the codebase. Apply consistency to naming, coding style, interfaces, and invariants [75-77]. Consistency creates cognitive leverage and reduces mistakes [75, 76]. Document and enforce conventions [78, 79].

## Red Flags to Watch For (Symptoms of Complexity)

The presence of these in generated code is a sign that the design may be overly complex and should be reconsidered:

*   **Shallow Module**: The interface doesn't hide much implementation complexity [3, 15, 53].
*   **Information Leakage**: Design decisions require modifications in multiple modules [4, 15].
*   **Temporal Decomposition**: Code structure follows execution order instead of information hiding [6, 15].
*   **Overexposure**: API users must learn about rarely used features to use common ones [15, 80].
*   **Pass-Through Method**: A method simply forwards calls to another [15, 27].
*   **Repetition**: Non-trivial code snippets are repeated [15, 81].
*   **Special-General Mixture**: General-purpose and special-purpose code are combined in the same module [15, 25].
*   **Conjoined Methods**: Methods are too dependent to be understood independently [15, 25].
*   **Comment Repeats Code**: Comments state the obvious from the code [15, 46].
*   **Implementation Documentation Contaminates Interface**: Interface comments include unnecessary implementation details [15, 57].
*   **Vague Name**: Names are imprecise and uninformative [15, 59].
*   **Hard to Pick Name**: Difficulty in naming suggests a design problem [15, 67].
*   **Hard to Describe**: Long, complicated comments for a variable or method indicate potential design issues [15, 82, 83].

By following these principles and avoiding these red flags, the generated code will be significantly simpler, more understandable, and easier to maintain.

*Note: This document is based on the provided source material and does not incorporate any prior conversation history, as none was available.*