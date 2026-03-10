export interface UserResponse {
	id: string;
	username: string;
	email: string;
	displayName: string;
	role: string;
	createdAt: string;
	updatedAt: string;
}

export interface UserPageResponse {
	content: UserResponse[];
	totalElements: number;
	totalPages: number;
	size: number;
	number: number;
	first: boolean;
	last: boolean;
}
