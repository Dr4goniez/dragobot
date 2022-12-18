// Show jsdoc for methods added to built-in JavaScript objects

interface String {

    /** Removes all U+200E spaces from a string and further trims it. */
    trim2(): string;

    /**
     * Splits a string into two at a delimiter and returns the result as an array.
     * @param delimiter
     * @param bottomup If true, splits at the last occurrence of the delimiter.
     * @returns If the delimiter is not found, one of the elements in the returned array will be empty.
     */
    split2(delimiter: string, bottomup?: boolean): string[];

}

interface Array<T> {

    /** Returns a new array without duplicate elements. */
    undup(): T[];

}

interface Object {

    /** Returns a deep copy of an object. */
    replicate(): object;

}