import { useCallback, useState } from 'react'
import { readAddressBook, writeAddressBook } from '../utils/websiteHelpers'

export function useSavedAddresses() {
  const [savedAddresses, setSavedAddresses] = useState(() => readAddressBook())

  const persistSavedAddresses = useCallback((nextAddresses) => {
    setSavedAddresses(nextAddresses)
    writeAddressBook(nextAddresses)
  }, [])

  return { savedAddresses, persistSavedAddresses }
}
