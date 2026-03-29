export type Role = 'resident' | 'chief_resident' | 'super_admin'

export interface Profile {
  uid: string
  email: string
  displayName: string
  role: Role
  clinicId: string | null
  seniority?: number
  createdAt?: string
  updatedAt?: string
}
