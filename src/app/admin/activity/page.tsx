'use client'

import styles from './activity.module.css'

export default function SystemActivityPage() {
  return (
    <div className={styles['dashboard-page']}>
      <div className={styles['header-section']}>
        <h1 className={styles['page-title']}>System Activity</h1>
        <p className={styles['subtitle']}>Monitor global platform operations and logs.</p>
      </div>

      <div className={styles['content-grid']}>
        <div className={`${styles['empty-state']} glass-panel`}>
          <div className={styles['empty-icon']}>🚧</div>
          <h3>Under Construction</h3>
          <p>This module is currently being built. Check back soon!</p>
        </div>
      </div>
    </div>
  )
}