import { readFileSync, readdirSync } from "node:fs"
import { isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { workspacePolicy } from "../oxlint.config.ts"

// Oxlint handles source imports. This checks only JSON metadata.
const root = fileURLToPath(new URL("../", import.meta.url))
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"))
const projects = Object.entries(workspacePolicy).map(([id, rule]) => ({
  id, ...rule, directory: resolve(root, id)
}))
const owner = (file) => projects.find((project) => {
  const path = relative(project.directory, file)
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
})
const byName = new Map(projects.filter((p) => p.name).map((p) => [p.name, p]))
const allowed = (from, to) => from.id === to.id || from.imports.includes(to.id)
let failures = 0
function report(file, code, message) {
  console.error(`${relative(root, file)}: ${code}: ${message}`)
  failures++
}

for (const entry of readdirSync(join(root, "packages"), { withFileTypes: true })) {
  if (entry.isDirectory() && !workspacePolicy[`packages/${entry.name}`]) {
    report(join(root, "packages", entry.name), "BOUNDARY_POLICY", "Workspace has no central policy")
  }
}
for (const project of projects) {
  for (const id of project.imports) {
    if (!workspacePolicy[id]) report(project.directory, "BOUNDARY_POLICY", `Unknown allowed project: ${id}`)
  }
  if (project.name) {
    const file = join(project.directory, "package.json")
    const manifest = readJson(file)
    if (manifest.name !== project.name) report(file, "BOUNDARY_POLICY", "Workspace name differs from central policy")
    for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const name of Object.keys(manifest[section] ?? {})) {
        const target = byName.get(name)
        if (target && !allowed(project, target)) {
          report(file, "BOUNDARY_MANIFEST", `${project.id} cannot depend on ${name}`)
        }
      }
    }
  }
  const file = join(project.directory, "tsconfig.json")
  for (const ref of readJson(file).references ?? []) {
    const target = owner(resolve(project.directory, ref.path))
    if (!target || !allowed(project, target)) report(file, "BOUNDARY_REFERENCE", `Forbidden project reference: ${ref.path}`)
  }
}
if (failures) process.exitCode = 1
else console.log("PASS workspace manifests and project references")
