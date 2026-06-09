import { useLayoutEffect, useRef, useState } from 'react'
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

  // posizione scroll per tab: cambiando tab salvo dove stavo e ripristino quella di destinazione
  const scrollPos = useRef({})
  const changeTab = (next) => {
    scrollPos.current[tab] = window.scrollY
    setTab(next)
  }
  useLayoutEffect(() => {
    window.scrollTo(0, scrollPos.current[tab] || 0)
  }, [tab])

  // Le pagine restano MONTATE (nascoste con CSS) così filtri, ordinamento e scroll non si resettano.
  const show = (id) => (tab === id ? '' : 'hidden')

  return (
    <div className="min-h-screen bg-bg max-w-screen-sm mx-auto pt-[env(safe-area-inset-top)]">
      <div className={show('list')}>
        <ListPage onOpen={onOpen} />
      </div>
      <div className={show('watch')}>
        <WatchlistPage onOpen={onOpen} />
      </div>
      <div className={show('compare')}>
        <ComparePage onOpen={onOpen} />
      </div>
      <div className={show('calendar')}>
        <CalendarPage onOpen={onOpen} />
      </div>

      <TabBar tab={tab} setTab={changeTab} />

      {detail && <StockDetail symbol={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
