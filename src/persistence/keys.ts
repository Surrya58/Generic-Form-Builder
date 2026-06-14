/** Partitioned localStorage key builders — saving one record never rewrites everything else. */
export const STORAGE_KEYS = {
  templatesIndex: 'fb:templates:index',
  template: (id: string): string => `fb:template:${id}`,
  instances: (templateId: string): string => `fb:instances:${templateId}`,
  draftTemplate: (id: string): string => `fb:draft:template:${id}`,
  draftInstance: (id: string): string => `fb:draft:instance:${id}`,
  trash: 'fb:trash',
} as const
