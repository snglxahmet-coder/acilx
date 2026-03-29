import { useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SwapCard from './SwapCard'

interface SwapRequest {
  id: string
  fromResident: { uid: string; name: string; seniority: number }
  toResident: { uid: string; name: string; seniority: number }
  fromDay: number
  toDay: number
  fromZone: { id: string; name: string; color: string }
  toZone: { id: string; name: string; color: string }
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

interface SwapListProps {
  swaps?: SwapRequest[]
  onAccept?: (id: string) => void
  onReject?: (id: string) => void
}

export default function SwapList({
  swaps: propSwaps,
  onAccept,
  onReject,
}: SwapListProps) {
  const swaps = propSwaps ?? []

  const pending = useMemo(
    () => swaps.filter((s) => s.status === 'pending'),
    [swaps]
  )
  const past = useMemo(
    () => swaps.filter((s) => s.status !== 'pending'),
    [swaps]
  )

  return (
    <Tabs defaultValue="pending">
      <TabsList className="w-full">
        <TabsTrigger value="pending" className="flex-1">
          Bekleyen ({pending.length})
        </TabsTrigger>
        <TabsTrigger value="past" className="flex-1">
          Geçmiş ({past.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-3 space-y-2">
        {pending.length === 0 ? (
          <EmptyState message="Bekleyen takas talebi yok." />
        ) : (
          pending.map((s) => (
            <SwapCard
              key={s.id}
              swap={s}
              isMine
              onAccept={onAccept}
              onReject={onReject}
            />
          ))
        )}
      </TabsContent>

      <TabsContent value="past" className="mt-3 space-y-2">
        {past.length === 0 ? (
          <EmptyState message="Geçmiş takas kaydı yok." />
        ) : (
          past.map((s) => <SwapCard key={s.id} swap={s} />)
        )}
      </TabsContent>
    </Tabs>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground text-center py-8">
      {message}
    </p>
  )
}
