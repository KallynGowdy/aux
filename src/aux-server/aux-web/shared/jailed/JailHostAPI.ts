export interface JailedHostAPI {
    /**
     * Sets the list of properties that are actually observables.
     * @param props The properties that should be treated as observables.
     */
    setObservablePropertyNames(props: string[]): void;
}
