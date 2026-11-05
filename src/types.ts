import type { Status } from './config'

export interface Profile {
  id: string; username: string; display_name: string
  role: 'admin' | 'head' | 'staff'; account_status: 'pending' | 'accepted' | 'blocked'
  elevated: boolean; department_id: string | null; telegram_username: string | null
  last_login_at: string | null; created_at: string
}
export interface Perm { capability: string; label: string; sort: number; role_admin: boolean; role_head: boolean; role_staff: boolean }
export interface Setting { key: string; value: string; label: string | null }
export interface Department { id: string; name: string }
export interface Discussion {
  id: string; seq: number; title: string; description: string; status: Status
  d_date: string | null; d_date_auto: boolean; creator_id: string; department_id: string | null
  decision_type: 'agreed' | 'approved' | null; decision_at: string | null; resolved_at: string | null
  review_on: string | null; deleted_at: string | null; created_at: string; updated_at: string
}
export interface Participant { discussion_id: string; user_id: string }
export interface ChecklistItem {
  id: string; discussion_id: string; title: string; is_complete: boolean; remarks: string | null
  sort_order: number; created_by: string | null; updated_by: string | null; updated_at: string
}
export interface AutoRule { id: string; user_id: string; keyword: string | null; is_exception: boolean }
export interface FollowUp {
  id: string; title: string; description: string; due_date: string; creator_id: string
  owner_id: string | null; linked_discussion_id: string | null; deleted_at: string | null; created_at: string
}
export interface Note { id: string; discussion_id: string | null; follow_up_id: string | null; author_id: string; body: string; created_at: string }
export interface Poll {
  id: string; question: string; creator_id: string; linked_discussion_id: string | null
  audience_all: boolean; status: 'open' | 'closed'; deleted_at: string | null; created_at: string; updated_at: string
}
export interface PollRecipient { poll_id: string; user_id: string }
export interface PollResponse { poll_id: string; user_id: string; response: 'Yes' | 'Some' | 'No'; created_at: string; updated_at: string }
export interface Log {
  id: number; actor_id: string | null; actor_name: string | null; entity_type: string; entity_id: string | null
  parent_id: string | null; action: string; before_data: any; after_data: any; created_at: string
}
export interface LoginEvent { id: number; username: string | null; user_agent: string | null; created_at: string }
