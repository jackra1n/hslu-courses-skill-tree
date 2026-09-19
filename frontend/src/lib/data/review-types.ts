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
	createdAt: number;
	updatedAt: number;
};

export type CourseReviewScore = {
	courseId: string;
	recommendation: number;
	count: number;
};

export type CourseReviewsResponse = {
	reviews: Review[];
	ownReviewId: string | null;
	summary: { count: number } & {
		[Dimension in keyof ReviewRatings]: number | null;
	};
};
