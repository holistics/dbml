/**
 * User Data Management
 *
 * Manages user preferences and state in localStorage using a single key.
 * Provides reactive state and automatic persistence.
 *
 * Design Principles Applied:
 * - Single Responsibility: Only handles user data persistence
 * - Information Hiding: Internal storage format is hidden
 * - Deep Module: Complex persistence logic with simple interface
 */
import { ref, watch, type Ref } from 'vue'
import type { UserData, PipelineStage } from '@/types'

const defaultUserData: UserData = {
  openingTab: 'lexer',
  isRawJson: false,
  isVim: false,
  dbml: `// Welcome to DBML Playground!
// Try editing this DBML schema

Table users {
  id integer [primary key]
  username varchar
  role varchar
  created_at timestamp
}

Table posts {
  id integer [primary key]
  title varchar
  body text [note: 'Content of the post']
  user_id integer
  status varchar
  created_at timestamp
}

Ref: posts.user_id > users.id // many-to-one`
}

const STORAGE_KEY = 'userData'

/**
 * Load user data from localStorage
 */
const loadUserData = (): UserData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge with defaults to handle missing properties
      return { ...defaultUserData, ...parsed }
    }
  } catch (error) {
    console.warn('Failed to load user data from localStorage:', error)
  }
  return { ...defaultUserData }
}

/**
 * Save user data to localStorage
 */
const saveUserData = (data: UserData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.warn('Failed to save user data to localStorage:', error)
  }
}

/**
 * Composable for managing user data
 */
export function useUserData() {
  // Initialize reactive state from localStorage
  const userData = ref<UserData>(loadUserData())

  // Auto-save when data changes
  watch(userData, (newData) => {
    saveUserData(newData)
  }, { deep: true })

  /**
   * Update a specific property
   */
  const updateUserData = <K extends keyof UserData>(key: K, value: UserData[K]): void => {
    userData.value[key] = value
  }

  /**
   * Reset to default values
   */
  const resetUserData = (): void => {
    userData.value = { ...defaultUserData }
  }

  /**
   * Save DBML content manually (for Cmd+S)
   */
  const saveDbml = (content: string): void => {
    updateUserData('dbml', content)
  }

  return {
    userData: userData as Ref<UserData>,
    updateUserData,
    resetUserData,
    saveDbml
  }
}