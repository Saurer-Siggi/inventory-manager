declare global {
	namespace App {
		interface Error {
			message: string
		}
		interface Locals {
			authed: boolean
		}
		interface LayoutData {
			isAdmin: boolean
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {}
