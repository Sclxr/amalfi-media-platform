# Pay before gallery download, with a trusted exception

Galleries default to `requirePaid`. A full-resolution or ZIP download is allowed when the related invoice is paid (`PAID` or `PARTIALLY_REFUNDED`), when the gallery does not require payment, or when an admin sets `Client.allowUnpaidDownloads`.

The download UI is not in Milestone 1. The decision function is the rule later code must call.
