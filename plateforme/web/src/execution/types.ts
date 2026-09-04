export type ErreurPython = {
  /** Nom de l'exception : "TypeError", "NameError", … */
  type: string
  /** Message brut renvoyé par Python, en anglais */
  message: string
  ligne: number | null
}

export type VariableLue = {
  /** repr() de la valeur, toujours sérialisée en chaîne */
  valeur: string
  /** type(...).__name__ : "int", "str", "bool", "float" */
  type: string
}

export type ResultatExecution = {
  stdout: string
  erreur: ErreurPython | null
  variables: Record<string, VariableLue>
  dureeMs: number
  timeout: boolean
}
