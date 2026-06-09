import { useState } from 'react'
import TabBar from './components/TabBar.jsx'
import StockDetail from './components/StockDetail.jsx'
import ListPage from './pages/ListPage.jsx'
import WatchlistPage from './pages/WatchlistPage.jsx'
import ComparePage from './pages/ComparePage.jsx'
import CalendarPage from './pages/CalendarPage.jsx'

export default function App() {
  const [tab, setTab] = useState('list')
  const [detail, setDetail] = useState(null)
  const onOpen = (symbol) => setDetail(symbol)

  return (
    <div className="min-h-screen bg-bg max-w-screen-sm mx-auto">
      {tab === 'list' && <ListPage onOpen={onOpen} />}
      {tab === 'watch' && <WatchlistPage onOpen={onOpen} />}
      {tab === 'compare' && <ComparePage onOpen={onOpen} />}
      {tab === 'calendar' && <CalendarPage onOpen={onOpen} />}

      <TabBar tab={tab} setTab={setTab} />

      {detail && <StockDetail symbol={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
