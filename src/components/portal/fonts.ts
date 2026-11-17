export { anton, arimo } from "@/fonts";

// Anton and Arimo are required by the design system but are NOT loaded by the
// root layout (which carries Bebas Neue, Inter and JetBrains Mono). Loading
// them here scopes them to the portal subtree — the root layout feeds 34 other
// surfaces and is explicitly out of scope for this PR.
//
// Anton is for campaign titles and stat figures only. Arimo is body copy.


