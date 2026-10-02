// Helper to extract error message from unknown error
// Works with axios errors and generic errors

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as {
      response?: { data?: { message?: string } }
      message?: string
    }

    return (
      err.response?.data?.message || err.message || 'Something went wrong'
    )
  }

  return 'Something went wrong'
}