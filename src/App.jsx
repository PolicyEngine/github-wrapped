import { useState, useEffect } from 'react'
import './App.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Filter out automated PRs from display list (not from counts)
const isAutomatedPR = (pr) => pr.title?.startsWith('Update PolicyEngine')

function App() {
  const [data, setData] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberData, setMemberData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  // Load pre-fetched data
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}github-data.json`)
      .then(res => res.json())
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const selectMember = (github) => {
    const member = data.members[github]
    if (!member) return
    setSelectedMember(member.member)
    setMemberData(member)
  }

  // Team members (for highlighting)
  const TEAM_MEMBERS = ['MaxGhenis', 'nikhilwoodruff', 'PavelMakarchuk', 'vahid-ahmadi', 'daphnehanse11', 'hua7450', 'anth-volk', 'DTrim99', 'elenacura', 'SakshiKekre']

  // Display name overrides
  const NAME_OVERRIDES = {
    'elenacura': 'Elena Cura'
  }

  // Helper to get display name
  const getDisplayName = (member) => {
    return NAME_OVERRIDES[member.github] || member.name
  }

  // Helper to check if someone is a team member
  const isTeamMember = (github) => TEAM_MEMBERS.includes(github)


  const maxMonthly = Math.max(...(memberData?.monthlyPRs || [1]), 1)

  if (loading) {
    return (
      <div className="app">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading GitHub data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app">
        <div className="error-state">
          <p>Error: {error}</p>
          <p>Run <code>node scripts/fetch-data.js</code> to generate data.</p>
        </div>
      </div>
    )
  }

  const team = Object.values(data.members).map(m => m.member)

  // Calculate aggregate stats for "All" view
  const aggregateStats = {
    commits: 0,
    prs: 0,
    reviews: 0,
    issues: 0,
    repos: new Set()
  }
  const aggregateMonthlyPRs = new Array(12).fill(0)
  const aggregateRepoCommits = {}

  Object.values(data.members).forEach(m => {
    aggregateStats.commits += m.stats?.commits || 0
    aggregateStats.prs += m.stats?.prs || 0
    aggregateStats.reviews += m.stats?.reviews || 0
    aggregateStats.issues += m.stats?.issues || 0
    Object.keys(m.repoCommits || {}).forEach(r => aggregateStats.repos.add(r))
    ;(m.monthlyPRs || []).forEach((count, i) => {
      aggregateMonthlyPRs[i] += count
    })
    Object.entries(m.repoCommits || {}).forEach(([repo, count]) => {
      aggregateRepoCommits[repo] = (aggregateRepoCommits[repo] || 0) + count
    })
  })

  return (
    <div className="app">
      <div className="bg-pattern" />

      <header className="header">
        <img
          src="https://raw.githubusercontent.com/PolicyEngine/policyengine-app/master/src/images/logos/policyengine/teal.svg"
          alt="PolicyEngine"
          className="logo"
        />
        <div className="header-content">
          <div className="year-badge">2025</div>
          <h1>Year in Code</h1>
        </div>
      </header>

      <nav className="team-nav">
        <button
          className={`team-btn ${selectedMember === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedMember('all')}
          style={{ '--delay': '0ms' }}
        >
          <span className="team-name">All</span>
          <span className="team-role">{team.length} contributors</span>
        </button>
        {team.map((member, i) => (
          <button
            key={member.github}
            className={`team-btn ${selectedMember?.github === member.github ? 'active' : ''}`}
            onClick={() => selectMember(member.github)}
            style={{ '--delay': `${(i + 1) * 50}ms` }}
          >
            <span className="team-name">{getDisplayName(member).split(' ')[0]}</span>
            <span className="team-role">{member.role}</span>
          </button>
        ))}
      </nav>

      <main className="main">
        {!selectedMember && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2>Select a contributor</h2>
            <p>View 2025 contributions to PolicyEngine</p>
          </div>
        )}

        {selectedMember === 'all' && (
          <div className="dashboard">
            <div className="profile">
              <div className="avatar-group">
                {team.slice(0, 5).map(m => (
                  <img key={m.github} src={`https://github.com/${m.github}.png`} alt={m.name} className="avatar-small" />
                ))}
                {team.length > 5 && <span className="avatar-more">+{team.length - 5}</span>}
              </div>
              <div>
                <h2>All Contributors</h2>
                <p>{team.length} people contributed in 2025</p>
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <div className="stat-value">{aggregateStats.commits.toLocaleString()}</div>
                <div className="stat-label">Commits</div>
              </div>
              <div className="stat">
                <div className="stat-value">{aggregateStats.prs.toLocaleString()}</div>
                <div className="stat-label">Pull Requests</div>
              </div>
              <div className="stat">
                <div className="stat-value">{aggregateStats.reviews.toLocaleString()}</div>
                <div className="stat-label">Reviews</div>
              </div>
              <div className="stat">
                <div className="stat-value">{aggregateStats.issues.toLocaleString()}</div>
                <div className="stat-label">Issues</div>
              </div>
              <div className="stat">
                <div className="stat-value">{aggregateStats.repos.size.toLocaleString()}</div>
                <div className="stat-label">Repos</div>
              </div>
            </div>

            <section className="section">
              <h3>Monthly PR Activity</h3>
              <div className="chart">
                {aggregateMonthlyPRs.map((count, i) => (
                  <div key={i} className="bar-wrap">
                    <div
                      className="bar"
                      style={{
                        '--height': `${Math.max((count / Math.max(...aggregateMonthlyPRs, 1)) * 100, 4)}%`,
                        '--delay': `${i * 40}ms`
                      }}
                    >
                      {count > 0 && <span className="bar-val">{count}</span>}
                    </div>
                    <span className="bar-label">{MONTHS[i]}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="section">
              <h3>Top Repositories (by commits)</h3>
              <ul className="repo-list">
                {Object.entries(aggregateRepoCommits)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 12)
                  .map(([repo, count], i) => (
                    <li key={repo} style={{ '--delay': `${i * 40}ms` }}>
                      <span className="repo-name">{repo}</span>
                      <span className="repo-count">{count}</span>
                    </li>
                  ))}
              </ul>
            </section>

            <section className="section">
              <h3>Contributors</h3>
              <div className="contributors-grid">
                {team.map((member, i) => {
                  const memberObj = data.members[member.github]
                  const memberStats = memberObj?.stats || {}
                  const prCount = memberStats.prs || 0
                  const isTeam = isTeamMember(member.github)
                  return (
                    <button
                      key={member.github}
                      className={`contributor-card ${isTeam ? 'team-member' : ''}`}
                      onClick={() => selectMember(member.github)}
                      style={{ '--delay': `${i * 30}ms` }}
                    >
                      <img src={`https://github.com/${member.github}.png`} alt={getDisplayName(member)} className="contributor-avatar" />
                      <div className="contributor-info">
                        <span className="contributor-name">{getDisplayName(member)}</span>
                        <span className="contributor-stats">
                          {memberStats.commits || 0} commits · {prCount} PRs
                        </span>
                      </div>
                      {isTeam && <span className="team-badge">Team</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {memberData && selectedMember && selectedMember !== 'all' && (
          <div className="dashboard">
            <div className="profile">
              <img
                src={`https://github.com/${selectedMember.github}.png`}
                alt={getDisplayName(selectedMember)}
                className="avatar"
              />
              <div>
                <h2>{getDisplayName(selectedMember)}</h2>
                <p>{selectedMember.role}</p>
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <div className="stat-value">{memberData.stats.commits.toLocaleString()}</div>
                <div className="stat-label">Commits</div>
              </div>
              <div className="stat">
                <div className="stat-value">{memberData.stats.prs.toLocaleString()}</div>
                <div className="stat-label">Pull Requests</div>
              </div>
              <div className="stat">
                <div className="stat-value">{memberData.stats.reviews.toLocaleString()}</div>
                <div className="stat-label">Reviews</div>
              </div>
              <div className="stat">
                <div className="stat-value">{memberData.stats.issues.toLocaleString()}</div>
                <div className="stat-label">Issues</div>
              </div>
              <div className="stat">
                <div className="stat-value">{memberData.stats.repos?.toLocaleString() || Object.keys(memberData.repoCommits || {}).length}</div>
                <div className="stat-label">Repos</div>
              </div>
            </div>

            <section className="section">
              <h3>Monthly PR Activity</h3>
              <div className="chart">
                {(memberData.monthlyPRs || []).map((count, i) => (
                  <div key={i} className="bar-wrap">
                    <div
                      className="bar"
                      style={{
                        '--height': `${Math.max((count / maxMonthly) * 100, 4)}%`,
                        '--delay': `${i * 40}ms`
                      }}
                    >
                      {count > 0 && <span className="bar-val">{count}</span>}
                    </div>
                    <span className="bar-label">{MONTHS[i]}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid-2">
              <section className="section">
                <h3>Top Repositories (by commits)</h3>
                <ul className="repo-list">
                  {Object.entries(memberData.repoCommits || {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([repo, count], i) => (
                      <li key={repo} style={{ '--delay': `${i * 40}ms` }}>
                        <span className="repo-name">{repo}</span>
                        <span className="repo-count">{count}</span>
                      </li>
                    ))}
                </ul>
              </section>

              <section className="section">
                <h3>Pull Requests</h3>
                <ul className="pr-list">
                  {(memberData.prs || []).filter(pr => !isAutomatedPR(pr)).slice(0, 20).map((pr, i) => {
                    const linesChanged = (pr.files || []).reduce((sum, f) => sum + (f.additions || 0) + (f.deletions || 0), 0)
                    const commits = pr.commits || 0
                    const comments = pr.comments || 0
                    return (
                      <li key={pr.id} style={{ '--delay': `${i * 30}ms` }}>
                        <a href={pr.html_url} target="_blank" rel="noopener noreferrer">
                          {pr.title}
                        </a>
                        <span className="pr-meta">
                          {pr.repository_url.split('/').pop()}
                          <span className={`status ${pr.state}`}>{pr.state}</span>
                        </span>
                        <span className="pr-stats">
                          <span className="pr-stat" title="Discussion threads">{comments + (pr.review_comments || 0)} 💬</span>
                          {commits > 0 && <span className="pr-stat" title="Commits">{commits} 📝</span>}
                          <span className="pr-stat" title="Lines changed">±{linesChanged.toLocaleString()}</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </div>

          </div>
        )}
      </main>

    </div>
  )
}

export default App
