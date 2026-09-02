package ma.dari.api.common.pagination;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.function.Function;

/**
 * The one paginated response shape for the whole API.
 *
 * <p>No total count. Counting matching rows is a second full query against the
 * same filters, and on the search path that doubles the cost of the most
 * expensive query in the system to render a number nobody acts on.
 *
 * @param nextCursor null when the last page has been reached
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CursorPage<T>(List<T> items, String nextCursor, boolean hasMore) {

    public static <T> CursorPage<T> of(List<T> items, String nextCursor) {
        return new CursorPage<>(items, nextCursor, nextCursor != null);
    }

    public static <T> CursorPage<T> last(List<T> items) {
        return new CursorPage<>(items, null, false);
    }

    public <R> CursorPage<R> map(Function<T, R> mapper) {
        return new CursorPage<>(items.stream().map(mapper).toList(), nextCursor, hasMore);
    }
}
