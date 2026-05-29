import { apiRequest } from './client'
import type {
  DomainConfigRead,
  DomainConfigUpdate,
  RestartResponse,
  SystemConfigRead,
  SystemConfigUpdate,
} from '../types/api'

export function getSystemConfig(): Promise<SystemConfigRead> {
  return apiRequest<SystemConfigRead>('/api/config/system')
}

export function updateSystemConfig(update: SystemConfigUpdate): Promise<SystemConfigRead> {
  return apiRequest<SystemConfigRead>('/api/config/system', {
    method: 'PUT',
    body: JSON.stringify(update),
  })
}

export function restartLightRAG(): Promise<RestartResponse> {
  return apiRequest<RestartResponse>('/api/config/lightrag/restart', {
    method: 'POST',
  })
}

export function getDomainConfig(): Promise<DomainConfigRead> {
  return apiRequest<DomainConfigRead>('/api/config/domain')
}

export function updateDomainConfig(update: DomainConfigUpdate): Promise<DomainConfigRead> {
  return apiRequest<DomainConfigRead>('/api/config/domain', {
    method: 'PUT',
    body: JSON.stringify(update),
  })
}
