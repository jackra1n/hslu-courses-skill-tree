export type ReviewRatings = {
	recommendation: number;
	contentInterest: number;
	difficulty: number;
	workload: number;
};

export type ReviewInput = ReviewRatings & { text: string };

export type Review = ReviewInput & {
	id: string;
	courseId: string;
	userId: string;
	authorName: string;
	createdAt: number;
	updatedAt: number;
};

export type CourseReviewsResponse = {
	reviews: Review[];
	summary: { count: number } & {
		[Dimension in keyof ReviewRatings]: number | null;
	};
};
